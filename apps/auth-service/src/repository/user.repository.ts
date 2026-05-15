import { Effect, Data }      from "effect"
import { db, schema }        from "@repo/database"
import { eq, desc, sql }     from "drizzle-orm"
import type { UserRole }     from "@/types"

class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

const findByEmail = (email: string) =>
  Effect.tryPromise({
    try:   () => db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const findById = (id: string) =>
  Effect.tryPromise({
    try:   () => db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const findAll = (opts: { page: number; limit: number; role?: UserRole }) =>
  Effect.tryPromise({
    try: async () => {
      const offset    = (opts.page - 1) * opts.limit
      const condition = opts.role ? eq(schema.users.role, opts.role) : undefined

      const [items, [countRow]] = await Promise.all([
        db.select().from(schema.users)
          .where(condition)
          .orderBy(desc(schema.users.createdAt))
          .limit(opts.limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(schema.users)
          .where(condition),
      ])

      const total      = countRow?.count ?? 0
      const totalPages = Math.ceil(total / opts.limit)

      return {
        items,
        total,
        page:       opts.page,
        limit:      opts.limit,
        totalPages,
        hasNext: opts.page < totalPages,
        hasPrev: opts.page > 1,
      }
    },
    catch: (e) => new DbError({ cause: e }),
  })

const create = (data: {
  email: string; name: string; passwordHash: string; role: UserRole
}) =>
  Effect.tryPromise({
    try:   () => db.insert(schema.users).values({ id: crypto.randomUUID(), ...data })
                   .returning().then(r => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

const updatePasswordHash = (id: string, passwordHash: string) =>
  Effect.tryPromise({
    try:   () => db.update(schema.users)
                   .set({ passwordHash, updatedAt: new Date() })
                   .where(eq(schema.users.id, id))
                   .returning()
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const update = (
  id:   string,
  data: { name?: string; phone?: string; avatarUrl?: string }
) =>
  Effect.tryPromise({
    try:   () => db.update(schema.users)
                   .set({ ...data, updatedAt: new Date() })
                   .where(eq(schema.users.id, id))
                   .returning()
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Update a user's role.
 * Intentionally separate from `update` so role mutations are explicit
 * and auditable.
 */
const updateRole = (id: string, role: UserRole) =>
  Effect.tryPromise({
    try:   () => db.update(schema.users)
                   .set({ role, updatedAt: new Date() })
                   .where(eq(schema.users.id, id))
                   .returning()
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Atomically swap ownership: `fromId` → ADMIN, `toId` → OWNER.
 * Both updates run inside a single Drizzle transaction.
 */
const transferOwnership = (fromId: string, toId: string) =>
  Effect.tryPromise({
    try: async () => {
      return await db.transaction(async (tx) => {
        const now = new Date()

        const [newOwner] = await tx.update(schema.users)
          .set({ role: "OWNER", updatedAt: now })
          .where(eq(schema.users.id, toId))
          .returning()

        const [prevOwner] = await tx.update(schema.users)
          .set({ role: "ADMIN", updatedAt: now })
          .where(eq(schema.users.id, fromId))
          .returning()

        if (!newOwner || !prevOwner) {
          throw new Error("transferOwnership: one or both users not found")
        }

        return { newOwner, prevOwner }
      })
    },
    catch: (e) => new DbError({ cause: e }),
  })

export const userRepository = {
  findByEmail,
  findById,
  findAll,
  create,
  update,
  updatePasswordHash,
  updateRole,
  transferOwnership,
}

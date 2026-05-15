import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq }           from "drizzle-orm"
import type { UserRole } from "@/types"

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
 *
 * Intentionally separate from `update` so role mutations are explicit
 * and auditable — callers must consciously call this function rather
 * than slipping a `role` field into a general-purpose update.
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
 *
 * Both updates run inside a single Drizzle transaction — there is
 * never a moment where zero or two users hold the OWNER role.
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
  create,
  update,
  updatePasswordHash,
  updateRole,
  transferOwnership,
}

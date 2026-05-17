import type { UserRole } from "@/types"
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { Data, Effect } from "effect"

import { ConflictError } from "@repo/common/errors"
import { db, schema } from "@repo/database"

class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

/**
 * Safe column projection for user listings — explicitly excludes passwordHash.
 *
 * Using db.select() (SELECT *) on a listing endpoint means passwordHash is
 * fetched from the DB and held in memory, even though it is immediately
 * stripped in the handler by shapeUser(). If a new code path ever forgets
 * shapeUser(), the hash leaks into the response.
 *
 * This projection enforces the exclusion at the query layer, so the hash
 * is never present in JavaScript memory for listing operations.
 *
 * Note: findByEmail / findById retain SELECT * because they are used by the
 * auth flow which requires passwordHash for credential verification.
 */
const SAFE_USER_COLUMNS = {
  id: schema.users.id,
  email: schema.users.email,
  name: schema.users.name,
  role: schema.users.role,
  avatarUrl: schema.users.avatarUrl,
  phone: schema.users.phone,
  createdAt: schema.users.createdAt,
  updatedAt: schema.users.updatedAt,
  deletedAt: schema.users.deletedAt,
} as const

// Postgres error code for unique constraint violation
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === "23505"
  )
}

const findByEmail = (email: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(schema.users)
        .where(
          and(eq(schema.users.email, email), isNull(schema.users.deletedAt))
        )
        .limit(1)
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const findById = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
        .limit(1)
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/** Like findById but also returns soft-deleted users — used by the restore endpoint. */
const findByIdIncludeDeleted = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1)
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const findAll = (opts: {
  page: number
  limit: number
  role?: UserRole
  includeDeleted?: boolean
}) =>
  Effect.tryPromise({
    try: async () => {
      const offset = (opts.page - 1) * opts.limit

      const conditions = [
        opts.role ? eq(schema.users.role, opts.role) : undefined,
        opts.includeDeleted ? undefined : isNull(schema.users.deletedAt),
      ].filter(Boolean) as Parameters<typeof and>

      const condition = conditions.length > 0 ? and(...conditions) : undefined

      const [items, [countRow]] = await Promise.all([
        db
          .select(SAFE_USER_COLUMNS)
          .from(schema.users) // explicit projection — no passwordHash
          .where(condition)
          .orderBy(desc(schema.users.createdAt))
          .limit(opts.limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.users)
          .where(condition),
      ])

      const total = countRow?.count ?? 0
      const totalPages = Math.ceil(total / opts.limit)

      return {
        items,
        total,
        page: opts.page,
        limit: opts.limit,
        totalPages,
        hasNext: opts.page < totalPages,
        hasPrev: opts.page > 1,
      }
    },
    catch: (e) => new DbError({ cause: e }),
  })

const create = (data: {
  email: string
  name: string
  passwordHash: string
  role: UserRole
}) =>
  Effect.tryPromise({
    try: () =>
      db
        .insert(schema.users)
        .values({ id: crypto.randomUUID(), ...data })
        .returning()
        .then((r) => r[0]!),
    // Map Postgres unique_violation (23505) on email → ConflictError → 409
    // so callers receive the correct semantic error instead of a generic 500.
    catch: (e) =>
      isUniqueViolation(e)
        ? new ConflictError("email")
        : new DbError({ cause: e }),
  })

const updatePasswordHash = (id: string, passwordHash: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning()
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const update = (
  id: string,
  data: { name?: string; phone?: string; avatarUrl?: string }
) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(schema.users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning()
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/** Role mutation — explicitly separate so mutations are auditable. */
const updateRole = (id: string, role: UserRole) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(schema.users)
        .set({ role, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning()
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Hard-delete a user row.
 * Callers are responsible for cascading session invalidation BEFORE
 * calling this — see adminDeleteUserHandler.
 */
const deleteById = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning()
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Soft-delete a user by setting deletedAt to now.
 * The row is preserved and can be restored by an OWNER.
 */
const softDeleteById = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(schema.users)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
        .returning()
        .then((r) => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Restore a previously soft-deleted user by clearing deletedAt.
 */
const restoreById = (id: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(schema.users)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(and(eq(schema.users.id, id), isNotNull(schema.users.deletedAt)))
        .returning()
        .then((r) => r[0] ?? null),
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

        const [newOwner] = await tx
          .update(schema.users)
          .set({ role: "OWNER", updatedAt: now })
          .where(eq(schema.users.id, toId))
          .returning()

        const [prevOwner] = await tx
          .update(schema.users)
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
  findByIdIncludeDeleted,
  findAll,
  create,
  update,
  updatePasswordHash,
  updateRole,
  deleteById,
  softDeleteById,
  restoreById,
  transferOwnership,
}

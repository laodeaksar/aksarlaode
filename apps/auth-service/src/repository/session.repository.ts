import { Effect, Data }        from "effect"
import { db, schema }          from "@repo/database"
import { eq, and, sql, inArray, asc } from "drizzle-orm"

class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

const create = (data: {
  id:        string
  userId:    string
  token:     string
  expiresAt: Date
}) =>
  Effect.tryPromise({
    try:   () => db.insert(schema.sessions).values(data).returning().then(r => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

const findByToken = (token: string) =>
  Effect.tryPromise({
    try:   () => db.select().from(schema.sessions)
                   .where(eq(schema.sessions.token, token)).limit(1)
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const deleteByToken = (token: string) =>
  Effect.tryPromise({
    try:   () => db.delete(schema.sessions).where(eq(schema.sessions.token, token)),
    catch: (e) => new DbError({ cause: e }),
  })

const deleteAllByUserId = (userId: string) =>
  Effect.tryPromise({
    try:   () => db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)),
    catch: (e) => new DbError({ cause: e }),
  })

const findPageByUserId = (
  userId: string,
  opts: { limit: number; offset: number },
) =>
  Effect.tryPromise({
    try: async () => {
      const [items, [countRow]] = await Promise.all([
        db.select({
            id:        schema.sessions.id,
            createdAt: schema.sessions.createdAt,
            expiresAt: schema.sessions.expiresAt,
          })
          .from(schema.sessions)
          .where(eq(schema.sessions.userId, userId))
          .orderBy(schema.sessions.createdAt)
          .limit(opts.limit)
          .offset(opts.offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(schema.sessions)
          .where(eq(schema.sessions.userId, userId)),
      ])
      return { items, total: countRow?.count ?? 0 }
    },
    catch: (e) => new DbError({ cause: e }),
  })

const findByIdAndUserId = (id: string, userId: string) =>
  Effect.tryPromise({
    try:   () => db.select().from(schema.sessions)
                   .where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, userId)))
                   .limit(1)
                   .then(r => r[0] ?? null),
    catch: (e) => new DbError({ cause: e }),
  })

const deleteByIdAndUserId = (id: string, userId: string) =>
  Effect.tryPromise({
    try:   () => db.delete(schema.sessions)
                   .where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, userId))),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Lightweight session count — used by the login handler to enforce the
 * per-user session cap without loading full session rows.
 */
const countByUserId = (userId: string) =>
  Effect.tryPromise({
    try: () =>
      db.select({ count: sql<number>`count(*)::int` })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, userId))
        .then(r => r[0]?.count ?? 0),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Delete the `count` oldest sessions for a user (ordered by createdAt ASC).
 *
 * Called by the login handler when a user already has MAX_SESSIONS active
 * sessions. Removing the oldest session(s) evicts the least-recently-used
 * device, making room for the new login without disrupting the other devices.
 *
 * Uses a subquery so the operation is a single round-trip:
 *   DELETE FROM sessions WHERE id IN (
 *     SELECT id FROM sessions WHERE userId = ? ORDER BY createdAt ASC LIMIT ?
 *   )
 */
const deleteOldestByUserId = (userId: string, count: number) =>
  Effect.tryPromise({
    try: async () => {
      const oldest = await db
        .select({ id: schema.sessions.id })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, userId))
        .orderBy(asc(schema.sessions.createdAt))
        .limit(count)

      if (oldest.length === 0) return

      const ids = oldest.map(r => r.id)
      await db.delete(schema.sessions).where(inArray(schema.sessions.id, ids))
    },
    catch: (e) => new DbError({ cause: e }),
  })

export const sessionRepository = {
  create,
  countByUserId,
  findByToken,
  findPageByUserId,
  findByIdAndUserId,
  deleteByToken,
  deleteByIdAndUserId,
  deleteAllByUserId,
  deleteOldestByUserId,
}

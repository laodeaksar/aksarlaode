import { Effect, Data }        from "effect"
import { db, schema }          from "@repo/database"
import { eq, and, sql, inArray, asc } from "drizzle-orm"

export type NewSessionData = {
  id:        string
  userId:    string
  token:     string
  expiresAt: Date
}

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

/**
 * Atomically delete an old session and insert a new one in a single Postgres
 * transaction — used by the refresh token rotation flow.
 *
 * ── Why a transaction ─────────────────────────────────────────────────────────
 * Without a transaction, two things can go wrong:
 *
 * 1. Delete succeeds, INSERT fails (transient DB error): the old refresh token
 *    is gone but no new session exists. The client's cookie is now orphaned —
 *    the next /auth/refresh attempt returns 401, forcing a re-login. This is
 *    a reliability issue that manifests as an unexpected forced-logout.
 *
 * 2. INSERT succeeds, Delete fails (less likely with sequential code, but
 *    possible if the connection drops mid-flight): two sessions now exist for
 *    the same logical "slot", leaking a row until the older one expires.
 *
 * With a transaction, exactly one of these outcomes is possible:
 *   (a) Both writes committed — rotation succeeded.
 *   (b) Neither write committed — client retries with the original cookie.
 */
const rotateSession = (oldTokenHash: string, newSessionData: NewSessionData) =>
  Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        await tx
          .delete(schema.sessions)
          .where(eq(schema.sessions.token, oldTokenHash))

        const [session] = await tx
          .insert(schema.sessions)
          .values(newSessionData)
          .returning()

        if (!session) {
          throw new Error("rotateSession: INSERT produced no rows")
        }

        return session
      }),
    catch: (e) => new DbError({ cause: e }),
  })

export const sessionRepository = {
  create,
  countByUserId,
  rotateSession,
  findByToken,
  findPageByUserId,
  findByIdAndUserId,
  deleteByToken,
  deleteByIdAndUserId,
  deleteAllByUserId,
  deleteOldestByUserId,
}

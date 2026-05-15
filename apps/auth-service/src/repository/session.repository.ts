import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq, and, sql } from "drizzle-orm"

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

export const sessionRepository = {
  create,
  findByToken,
  findPageByUserId,
  findByIdAndUserId,
  deleteByToken,
  deleteByIdAndUserId,
  deleteAllByUserId,
}

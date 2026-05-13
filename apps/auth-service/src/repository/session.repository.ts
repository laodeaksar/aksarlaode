import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq }           from "drizzle-orm"

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

export const sessionRepository = { create, findByToken, deleteByToken, deleteAllByUserId }

import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq }           from "drizzle-orm"

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
  email: string; name: string; passwordHash: string; role: "CUSTOMER" | "ADMIN"
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

export const userRepository = { findByEmail, findById, create, update, updatePasswordHash }

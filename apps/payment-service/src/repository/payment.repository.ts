import { Effect, Data } from "effect"
import { db, schema, eq } from "@repo/database"

class PaymentNotFoundError extends Data.TaggedError("PaymentNotFoundError")<{ id: string }> {}
class DbError             extends Data.TaggedError("DbError")<{ cause: unknown }> {}

export type NewPayment = {
  id:         string
  orderId:    string
  userId:     string
  snapToken:  string
  snapUrl:    string
  amount:     number
  status:     string
}

const findByOrderId = (orderId: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try:   () => db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).limit(1),
      catch: (e) => new DbError({ cause: e }),
    })
    const row = rows[0]
    if (!row) return yield* Effect.fail(new PaymentNotFoundError({ id: orderId }))
    return row
  })

const create = (data: NewPayment) =>
  Effect.tryPromise({
    try:   () => db.insert(schema.payments).values(data).returning().then(r => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

const updateStatus = (orderId: string, status: string) =>
  Effect.tryPromise({
    try:   () =>
      db.update(schema.payments)
        .set({ status })
        .where(eq(schema.payments.orderId, orderId))
        .returning()
        .then(r => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

export const paymentRepository = { findByOrderId, create, updateStatus }

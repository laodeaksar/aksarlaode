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

export type PaymentUpdate = {
  status:       string
  paymentType?: string | null
  paidAt?:      Date   | null
}

// ── findByOrderId ─────────────────────────────────────────────────────────
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

// ── create ────────────────────────────────────────────────────────────────
const create = (data: NewPayment) =>
  Effect.tryPromise({
    try:   () => db.insert(schema.payments).values(data).returning().then(r => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

// ── updateStatus ──────────────────────────────────────────────────────────
const updateStatus = (orderId: string, status: string) =>
  Effect.tryPromise({
    try: () =>
      db.update(schema.payments)
        .set({ status })
        .where(eq(schema.payments.orderId, orderId))
        .returning()
        .then(r => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

// FIX PAY-02: upsert — create payment record on first initiation, refresh the
// snapToken on subsequent calls for the same order (idempotent).
const upsert = (data: {
  orderId:   string
  userId:    string
  amount:    number
  snapToken: string
  status:    string
}) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.insert(schema.payments)
          .values({
            id:        crypto.randomUUID(),
            orderId:   data.orderId,
            userId:    data.userId,
            snapToken: data.snapToken,
            snapUrl:   "",
            amount:    data.amount,
            status:    data.status,
          })
          .onConflictDoUpdate({
            target: schema.payments.orderId,
            set: {
              snapToken:  data.snapToken,
              status:     data.status,
              updatedAt:  new Date(),
            },
          })
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    })

    const row = rows[0]
    if (!row) return yield* Effect.fail(new DbError({ cause: "Upsert returned no rows" }))
    return row
  })

// FIX PAY-02: updateByOrderId — updates payment status, paymentType, and paidAt
// after a Midtrans webhook notification. The previous webhookHandler called this
// but it was never defined, crashing every webhook with TypeError.
const updateByOrderId = (orderId: string, data: PaymentUpdate) =>
  Effect.gen(function* () {
    const set: Record<string, unknown> = {
      status:    data.status,
      updatedAt: new Date(),
    }
    if (data.paymentType !== undefined) set.paymentType = data.paymentType
    if (data.paidAt      !== undefined) set.paidAt      = data.paidAt

    const rows = yield* Effect.tryPromise({
      try: () =>
        db.update(schema.payments)
          .set(set)
          .where(eq(schema.payments.orderId, orderId))
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    })

    const row = rows[0]
    if (!row) return yield* Effect.fail(new PaymentNotFoundError({ id: orderId }))
    return row
  })

export const paymentRepository = {
  findByOrderId,
  create,
  updateStatus,
  upsert,           // FIX PAY-02
  updateByOrderId,  // FIX PAY-02
}

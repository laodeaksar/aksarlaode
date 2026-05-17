import { Data, Effect } from "effect"

import { db, eq, schema } from "@repo/database"

class PaymentNotFoundError extends Data.TaggedError("PaymentNotFoundError")<{
  id: string
}> {}
class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

export type NewPayment = {
  id: string
  orderId: string
  userId: string
  snapToken: string
  snapUrl: string
  amount: number
  status: string
}

export type PaymentUpdate = {
  status: string
  paymentType?: string | null
  paidAt?: Date | null
}

// ── findByOrderId ─────────────────────────────────────────────────────────
const findByOrderId = (orderId: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.orderId, orderId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    })
    const row = rows[0]
    if (!row)
      return yield* Effect.fail(new PaymentNotFoundError({ id: orderId }))
    return row
  })

// ── create ────────────────────────────────────────────────────────────────
const create = (data: NewPayment) =>
  Effect.tryPromise({
    try: () =>
      db
        .insert(schema.payments)
        .values(data)
        .returning()
        .then((r) => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

// ── updateStatus ──────────────────────────────────────────────────────────
const updateStatus = (orderId: string, status: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(schema.payments)
        .set({ status })
        .where(eq(schema.payments.orderId, orderId))
        .returning()
        .then((r) => r[0]!),
    catch: (e) => new DbError({ cause: e }),
  })

// FIX PAY-02: upsert — create payment record on first initiation, refresh the
// snapToken on subsequent calls for the same order (idempotent).
// FIX PAY-07: accept userEmail so it is stored at initiation time.
const upsert = (data: {
  orderId: string
  userId: string
  amount: number
  snapToken: string
  status: string
  userEmail?: string
}) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(schema.payments)
          .values({
            id: crypto.randomUUID(),
            orderId: data.orderId,
            userId: data.userId,
            snapToken: data.snapToken,
            amount: data.amount,
            status: data.status,
            ...(data.userEmail ? { userEmail: data.userEmail } : {}),
          })
          .onConflictDoUpdate({
            target: schema.payments.orderId,
            set: {
              snapToken: data.snapToken,
              status: data.status,
              updatedAt: new Date(),
              ...(data.userEmail ? { userEmail: data.userEmail } : {}),
            },
          })
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    })

    const row = rows[0]
    if (!row)
      return yield* Effect.fail(
        new DbError({ cause: "Upsert returned no rows" })
      )

    // FIX PAY-08: write immutable audit entry for initiation
    yield* insertAuditLog({
      paymentId: row.id,
      orderId: row.orderId,
      userId: row.userId,
      event: "payment_initiated",
      oldStatus: null,
      newStatus: row.status,
      amount: row.amount,
      paymentType: null,
    })

    return row
  })

// FIX PAY-02: updateByOrderId — updates payment status, paymentType, and paidAt
// after a Midtrans webhook notification.
const updateByOrderId = (orderId: string, data: PaymentUpdate) =>
  Effect.gen(function* () {
    // Fetch current status for audit log before update
    const existing = yield* findByOrderId(orderId)

    const set: Record<string, unknown> = {
      status: data.status,
      updatedAt: new Date(),
    }
    if (data.paymentType !== undefined) set.paymentType = data.paymentType
    if (data.paidAt !== undefined) set.paidAt = data.paidAt

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.payments)
          .set(set)
          .where(eq(schema.payments.orderId, orderId))
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    })

    const row = rows[0]
    if (!row)
      return yield* Effect.fail(new PaymentNotFoundError({ id: orderId }))

    // FIX PAY-08: write immutable audit entry for every status transition
    yield* insertAuditLog({
      paymentId: row.id,
      orderId: row.orderId,
      userId: row.userId,
      event: "payment_status_changed",
      oldStatus: existing.status,
      newStatus: row.status,
      amount: row.amount,
      paymentType: data.paymentType ?? null,
    })

    return row
  })

// ── insertAuditLog ────────────────────────────────────────────────────────
// FIX PAY-08: append-only audit log for forensic reconciliation.
// Failures are logged but never propagate — the audit trail must never
// cause a payment flow to fail.
const insertAuditLog = (entry: {
  paymentId: string
  orderId: string
  userId: string
  event: string
  oldStatus: string | null
  newStatus: string
  amount: number
  paymentType: string | null
  metadata?: Record<string, unknown>
}) =>
  Effect.tryPromise({
    try: () =>
      db.insert(schema.paymentAuditLog).values({
        id: crypto.randomUUID(),
        paymentId: entry.paymentId,
        orderId: entry.orderId,
        userId: entry.userId,
        event: entry.event,
        oldStatus: entry.oldStatus ?? undefined,
        newStatus: entry.newStatus,
        amount: entry.amount,
        paymentType: entry.paymentType ?? undefined,
        metadata: entry.metadata,
      }),
    catch: (e) => {
      console.error(
        JSON.stringify({
          event: "payment_audit_log_write_failed",
          orderId: entry.orderId,
          error: String(e),
        })
      )
      return new DbError({ cause: e })
    },
  }).pipe(Effect.orElse(() => Effect.void))

export const paymentRepository = {
  findByOrderId,
  create,
  updateStatus,
  upsert, // FIX PAY-02
  updateByOrderId, // FIX PAY-02
}

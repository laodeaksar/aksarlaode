import { paymentRepository } from "@/repository/payment.repository"
import type { AppEnv } from "@/types"
import { Effect } from "effect"
import type { Context } from "hono"

import { InitiatePaymentSchema } from "@repo/common"

import { createSnapTransaction } from "@/lib/midtrans"

export const initiateHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")!
  // FIX PAY-07: read email injected by api-gateway (AUTH-04) so it can be
  // stored on the payment record; webhook then reads it directly without a
  // round-trip to auth-service.
  const userEmail = c.req.header("x-user-email") ?? undefined
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input
    const input = yield* Effect.try({
      try: () => InitiatePaymentSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    // 2. Idempotency check — don't double-charge the same order.
    //    findByOrderId fails with PaymentNotFoundError when no record exists
    //    (first initiation — the happy path).  Use Effect.either to convert the
    //    failure into a value so we can branch on it without aborting the gen.
    const existing = yield* Effect.either(
      paymentRepository.findByOrderId(input.orderId)
    )

    if (existing._tag === "Right") {
      const payment = existing.right
      if (payment.status === "PAID") {
        return yield* Effect.fail({ _tag: "AlreadyPaidError" as const })
      }
      // If a PENDING record already exists, return the existing snapToken so the
      // client can reuse it rather than creating a duplicate Midtrans transaction.
      return {
        snapToken: payment.snapToken,
        redirectUrl: payment.snapUrl ?? "",
        paymentId: payment.id,
      }
    }

    // 3. Create Midtrans Snap token (first initiation or retried after error)
    const snap = yield* createSnapTransaction({
      orderId: input.orderId,
      amount: input.amount,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      items: input.items,
    })

    // 4. Persist payment record (upsert handles concurrent duplicate calls)
    const payment = yield* paymentRepository.upsert({
      orderId: input.orderId,
      userId,
      amount: input.amount,
      snapToken: snap.token,
      status: "PENDING",
      userEmail,
    })

    return {
      snapToken: snap.token,
      redirectUrl: snap.redirectUrl,
      paymentId: payment.id,
    }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag?: string }
    if (err?._tag === "ValidationError")
      return c.json({ error: "Invalid input" }, 422)
    if (err?._tag === "AlreadyPaidError")
      return c.json({ error: "Order already paid" }, 409)
    if (err?._tag === "MidtransError")
      return c.json({ error: "Payment gateway error" }, 502)
    return c.json({ error: "Payment initiation failed" }, 500)
  }

  return c.json(result.value, 201)
}

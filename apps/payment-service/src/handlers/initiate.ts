import { Effect } from "effect"
import type { Context } from "hono"
import { createSnapTransaction } from "../lib/midtrans"
import { paymentRepository }     from "../repository/payment.repository"
import { InitiatePaymentSchema } from "@repo/common"
import type { AppEnv } from "../types"

export const initiateHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")!
  const body   = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate
    const input = yield* Effect.try({
      try:   () => InitiatePaymentSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    // 2. Idempotency check — don't double-charge same order
    const existing = yield* paymentRepository.findByOrderId(input.orderId)
    if (existing?.status === "PAID") {
      return yield* Effect.fail({ _tag: "AlreadyPaidError" as const })
    }

    // 3. Create Midtrans Snap token
    const snap = yield* createSnapTransaction({
      orderId:       input.orderId,
      amount:        input.amount,
      customerName:  input.customerName,
      customerEmail: input.customerEmail,
      items:         input.items,
    })

    // 4. Persist pending payment record
    const payment = yield* paymentRepository.upsert({
      orderId:   input.orderId,
      userId,
      amount:    input.amount,
      snapToken: snap.token,
      status:    "PENDING",
    })

    return { snapToken: snap.token, redirectUrl: snap.redirectUrl, paymentId: payment.id }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "ValidationError") return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "AlreadyPaidError") return c.json({ error: "Order already paid" }, 409)
    if (err._tag === "MidtransError")   return c.json({ error: "Payment gateway error" }, 502)
    return c.json({ error: "Payment initiation failed" }, 500)
  }

  return c.json(result.value, 201)
}

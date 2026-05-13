import { Effect } from "effect"
import type { Context } from "hono"
import { paymentRepository } from "../repository/payment.repository"
import { orderClient }       from "../lib/order-client"
import { emailQueue }        from "../lib/email-queue"
import type { MidtransNotification } from "../lib/midtrans"
import type { AppEnv } from "../types"

// Midtrans transaction_status → our PaymentStatus
const STATUS_MAP: Record<string, string> = {
  capture:  "PAID",
  settlement: "PAID",
  pending:  "PENDING",
  deny:     "FAILED",
  cancel:   "CANCELLED",
  expire:   "EXPIRED",
  refund:   "REFUNDED",
}

export const webhookHandler = async (c: Context<AppEnv>) => {
  // Body already validated by HMAC middleware in api-gateway
  const notification = await c.req.json<MidtransNotification>()

  const program = Effect.gen(function* () {
    const paymentStatus = STATUS_MAP[notification.transaction_status] ?? "UNKNOWN"

    // 1. Update payment record
    const payment = yield* paymentRepository.updateByOrderId(notification.order_id, {
      status:      paymentStatus,
      paymentType: notification.payment_type,
      paidAt:      paymentStatus === "PAID" ? new Date() : undefined,
    })

    // 2. Sync order-service with new status
    yield* orderClient.updateStatus(notification.order_id, paymentStatus)

    // 3. Side effects — fire-and-forget via BullMQ
    if (paymentStatus === "PAID") {
      yield* emailQueue.add("order-confirmation", {
        orderId: notification.order_id,
        userId:  payment.userId,
        amount:  payment.amount,
      })
    }

    if (paymentStatus === "EXPIRED" || paymentStatus === "CANCELLED") {
      // Release stock reservation
      yield* orderClient.releaseStock(notification.order_id)

      yield* emailQueue.add("order-cancelled", {
        orderId: notification.order_id,
        userId:  payment.userId,
        reason:  paymentStatus,
      })
    }

    return { received: true }
  })

  const result = await Effect.runPromiseExit(program)

  // Always return 200 to Midtrans — retries if we 5xx
  if (result._tag === "Failure") {
    console.error("Webhook processing failed", result.cause)
    return c.json({ received: false }, 200)
  }

  return c.json(result.value, 200)
}

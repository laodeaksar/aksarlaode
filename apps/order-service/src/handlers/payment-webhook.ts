import { createHash }      from "crypto"
import type { Context }    from "elysia"
import { env }             from "@repo/env/order"
import { redis }           from "@/lib/redis"
import { orderRepository } from "@/repository/order.repository"

// ── Midtrans notification body (partial — only fields we use) ───────────────
type MidtransNotification = {
  order_id:           string   // maps to our orderId
  transaction_id:     string   // Midtrans unique transaction ID (used as event nonce)
  transaction_status: string   // settlement | capture | cancel | deny | expire | failure | pending
  status_code:        string   // "200", "201", "202", etc.
  gross_amount:       string   // "10000.00"
  fraud_status?:      string   // accept | challenge | deny
  signature_key:      string   // SHA512(order_id + status_code + gross_amount + ServerKey)
}

// Midtrans transaction statuses that mean a successful payment
const PAID_STATUSES = new Set(["capture", "settlement"])
const FAILED_STATUSES = new Set(["cancel", "deny", "expire", "failure"])

// ── Signature verification ──────────────────────────────────────────────────
function verifyMidtransSignature(notification: MidtransNotification): boolean {
  const payload  = notification.order_id + notification.status_code + notification.gross_amount + env.MIDTRANS_SERVER_KEY
  const expected = createHash("sha512").update(payload).digest("hex")

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== notification.signature_key.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ notification.signature_key.charCodeAt(i)
  }
  return diff === 0
}

// ── Handler ─────────────────────────────────────────────────────────────────
export const paymentWebhookHandler = async ({ body, set }: Context) => {
  const notification = body as MidtransNotification

  // ── 1. Validate Midtrans HMAC signature ──────────────────────────────────
  if (!verifyMidtransSignature(notification)) {
    console.warn(JSON.stringify({
      event:   "webhook_invalid_signature",
      orderId: notification.order_id,
    }))
    set.status = 401
    return { error: "Invalid signature" }
  }

  const { order_id: orderId, transaction_id: transactionId, transaction_status, fraud_status } = notification

  // ── 2. Idempotency — reject already-processed events (replay attack guard) ─
  const nonceKey = `webhook:processed:${transactionId}`
  const alreadyProcessed = await redis.set(nonceKey, "1", "EX", 86_400, "NX")
  if (!alreadyProcessed) {
    // NX failed → key already existed → duplicate delivery
    return { ok: true, note: "already_processed" }
  }

  // ── 3. Reject fraudulent transactions ────────────────────────────────────
  if (fraud_status === "deny") {
    console.warn(JSON.stringify({ event: "webhook_fraud_denied", orderId, transactionId }))
    set.status = 200
    return { ok: true }
  }

  // ── 4. Map Midtrans status to our order status ────────────────────────────
  let newStatus: "PAID" | "CANCELLED" | null = null

  if (PAID_STATUSES.has(transaction_status) && fraud_status !== "deny") {
    newStatus = "PAID"
  } else if (FAILED_STATUSES.has(transaction_status)) {
    newStatus = "CANCELLED"
  }

  if (!newStatus) {
    // pending or other intermediate status — acknowledge without updating
    return { ok: true }
  }

  // ── 5. Update order status ────────────────────────────────────────────────
  const { Effect } = await import("effect")
  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(orderId, newStatus, `midtrans:${transaction_status}`, "service:midtrans")
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") {
      console.error(JSON.stringify({ event: "webhook_order_not_found", orderId, transactionId }))
      // Return 200 so Midtrans doesn't keep retrying for genuinely missing orders
      return { ok: true }
    }
    console.error(JSON.stringify({ event: "webhook_update_failed", orderId, transactionId }))
    set.status = 500
    return { error: "Failed to update order" }
  }

  console.info(JSON.stringify({
    event:              "webhook_processed",
    orderId,
    transactionId,
    newStatus,
    transactionStatus:  transaction_status,
  }))

  return { ok: true }
}

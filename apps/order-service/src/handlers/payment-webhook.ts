import { createHash } from "crypto";

import { Effect } from "effect";

import type { Context } from "elysia";

import { env } from "@repo/env/order";

import { productClient } from "@/lib/product-client";
import { checkWebhookRateLimit } from "@/lib/rate-limiter";
import { redis } from "@/lib/redis";
import {
  InvalidTransitionError,
  orderRepository,
} from "@/repository/order.repository";

// ── Midtrans notification body (partial — only fields we use) ───────────────
type MidtransNotification = {
  order_id: string; // maps to our orderId
  transaction_id: string; // Midtrans unique transaction ID (used as event nonce)
  transaction_status: string; // settlement | capture | cancel | deny | expire | failure | pending
  status_code: string; // "200", "201", "202", etc.
  gross_amount: string; // "10000.00"
  fraud_status?: string; // accept | challenge | deny
  signature_key: string; // SHA512(order_id + status_code + gross_amount + ServerKey)
};

// Midtrans transaction statuses that mean a successful payment
const PAID_STATUSES = new Set(["capture", "settlement"]);
const FAILED_STATUSES = new Set(["cancel", "deny", "expire", "failure"]);

// ── Signature verification ──────────────────────────────────────────────────
function verifyMidtransSignature(notification: MidtransNotification): boolean {
  const payload =
    notification.order_id +
    notification.status_code +
    notification.gross_amount +
    env.MIDTRANS_SERVER_KEY;
  const expected = createHash("sha512").update(payload).digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== notification.signature_key.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ notification.signature_key.charCodeAt(i);
  }
  return diff === 0;
}

// ── Stock release helper ─────────────────────────────────────────────────────
async function releaseOrderStock(
  orderId: string,
  transactionId: string
): Promise<void> {
  const orderResult = await Effect.runPromiseExit(
    orderRepository.findByOrderId(orderId)
  );

  if (orderResult._tag === "Failure") {
    console.error(
      JSON.stringify({
        event: "webhook_stock_release_order_missing",
        orderId,
        transactionId,
      })
    );
    return;
  }

  const order = orderResult.value;

  // Only release stock if the order was in a reservable state.
  // PAID orders have already been fulfilled — do not release.
  // DELIVERED / SHIPPED orders must go through a formal refund flow.
  const RELEASABLE_STATUSES = new Set(["CANCELLED", "PENDING_PAYMENT"]);
  if (!RELEASABLE_STATUSES.has(order.status)) {
    console.warn(
      JSON.stringify({
        event: "webhook_stock_release_skipped",
        reason: `order already in status ${order.status}`,
        orderId,
        transactionId,
      })
    );
    return;
  }

  const releaseResult = await Effect.runPromiseExit(
    Effect.all(
      order.items.map((item) =>
        productClient.releaseStock(item.productId, item.quantity)
      ),
      { concurrency: "unbounded" }
    )
  );

  if (releaseResult._tag === "Failure") {
    // Log the failure but do NOT re-throw — we must still return 200 to Midtrans
    // so it does not keep retrying. A background reconciliation job should
    // catch any lingering reservations via a separate sweep.
    console.error(
      JSON.stringify({
        event: "webhook_stock_release_failed",
        orderId,
        transactionId,
        itemCount: order.items.length,
      })
    );
    return;
  }

  console.info(
    JSON.stringify({
      event: "webhook_stock_released",
      orderId,
      transactionId,
      itemCount: order.items.length,
      items: order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    })
  );
}

// ── Source IP extraction — respects reverse-proxy forwarding headers ──────────
function extractSourceIp(request: Request): string {
  // x-forwarded-for may contain a chain: "client, proxy1, proxy2" — take leftmost
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

// ── Handler ─────────────────────────────────────────────────────────────────
export const paymentWebhookHandler = async ({
  body,
  request,
  set,
}: Context) => {
  const notification = body as MidtransNotification;

  // ── 0. Rate limit — sliding window per source IP ──────────────────────────
  // Checked first — before signature verification — as a cheap gate against
  // flood attacks that would otherwise burn CPU on SHA-512 comparisons.
  //
  // On rejection we return 200 (not 429) so Midtrans does not interpret the
  // response as a server error and keeps re-queuing legitimate retries.
  // The flood is absorbed silently; a warning is logged for alerting.
  const sourceIp = extractSourceIp(request);
  const rl = await checkWebhookRateLimit(sourceIp);

  if (!rl.allowed) {
    console.warn(
      JSON.stringify({
        event: "webhook_rate_limited",
        sourceIp,
        orderId: notification?.order_id ?? "unknown",
        limit: rl.limit,
        resetMs: rl.resetMs,
      })
    );
    // 200 ACK — Midtrans will not retry; the real Midtrans server will
    // naturally retry via its own schedule when the window resets.
    return { ok: true, note: "rate_limited" };
  }

  // ── 1. Validate Midtrans HMAC signature ──────────────────────────────────
  if (!verifyMidtransSignature(notification)) {
    console.warn(
      JSON.stringify({
        event: "webhook_invalid_signature",
        orderId: notification.order_id,
      })
    );
    set.status = 401;
    return { error: "Invalid signature" };
  }

  const {
    order_id: orderId,
    transaction_id: transactionId,
    transaction_status,
    fraud_status,
  } = notification;

  // ── 2. Idempotency — reject already-processed events (replay attack guard) ─
  const nonceKey = `webhook:processed:${transactionId}`;
  const lockAcquired = await redis.set(nonceKey, "1", "EX", 86_400, "NX");
  if (!lockAcquired) {
    // NX failed → key already existed → duplicate delivery, safe to ack
    return { ok: true, note: "already_processed" };
  }

  // ── 3. Reject fraudulent transactions ────────────────────────────────────
  if (fraud_status === "deny") {
    console.warn(
      JSON.stringify({ event: "webhook_fraud_denied", orderId, transactionId })
    );
    // Treat as a failed payment — cancel order and release stock
    await releaseOrderStock(orderId, transactionId);
    return { ok: true };
  }

  // ── 4. Map Midtrans status to our order status ────────────────────────────
  let newStatus: "PAID" | "CANCELLED" | null = null;

  if (PAID_STATUSES.has(transaction_status) && fraud_status !== "deny") {
    newStatus = "PAID";
  } else if (FAILED_STATUSES.has(transaction_status)) {
    newStatus = "CANCELLED";
  }

  if (!newStatus) {
    // pending or other intermediate status — acknowledge without updating
    return { ok: true };
  }

  // ── 5. Update order status ────────────────────────────────────────────────
  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(
      orderId,
      newStatus,
      `midtrans:${transaction_status}`,
      "service:midtrans"
    )
  );

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string };
    if (err._tag === "OrderNotFoundError") {
      console.error(
        JSON.stringify({
          event: "webhook_order_not_found",
          orderId,
          transactionId,
        })
      );
      // Return 200 so Midtrans doesn't keep retrying for genuinely missing orders
      return { ok: true };
    }
    if (err._tag === "InvalidTransitionError") {
      const te = err as InstanceType<typeof InvalidTransitionError>;
      console.warn(
        JSON.stringify({
          event: "webhook_transition_rejected",
          orderId,
          transactionId,
          from: te.from,
          to: te.to,
          note: "Order already in a terminal or incompatible state — skipping update",
        })
      );
      // ACK with 200 — Midtrans should not retry; order is in a valid terminal state
      return { ok: true };
    }
    console.error(
      JSON.stringify({ event: "webhook_update_failed", orderId, transactionId })
    );
    set.status = 500;
    return { error: "Failed to update order" };
  }

  // ── 6. Auto-release reserved stock on payment failure ────────────────────
  //    PAID orders: stock reservation is fulfilled — do not release.
  //    CANCELLED orders: reserved stock must be returned to inventory so
  //    other buyers can purchase the same items immediately.
  if (newStatus === "CANCELLED") {
    await releaseOrderStock(orderId, transactionId);
  }

  console.info(
    JSON.stringify({
      event: "webhook_processed",
      orderId,
      transactionId,
      newStatus,
      transactionStatus: transaction_status,
    })
  );

  return { ok: true };
};

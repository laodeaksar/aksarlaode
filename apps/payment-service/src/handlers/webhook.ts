import { Effect } from "effect";

import type { Context } from "hono";

import { emailQueue } from "@/lib/email-queue";
import type { MidtransNotification } from "@/lib/midtrans";
import { orderClient } from "@/lib/order-client";
import { paymentRepository } from "@/repository/payment.repository";
import type { AppEnv } from "@/types";

// FIX PAY-04: split into two maps.
//
// PAYMENT_STATUS_MAP stores the internal payment record status — mirrors
// Midtrans transaction_status values faithfully.
//
// ORDER_STATUS_MAP maps to the OrderStatus enum accepted by order-service.
// "deny" / "expire" / "cancel" all map to "CANCELLED" (the only terminal-
// failure state in the order state machine).  "pending" maps to null meaning
// "do not change the order status" — the order is already PENDING_PAYMENT.
// Sending "PENDING" would make order-service return 422 (not a valid enum
// value) and leave the order-service status stale.

const PAYMENT_STATUS_MAP: Record<string, string> = {
  capture: "PAID",
  settlement: "PAID",
  pending: "PENDING",
  deny: "FAILED",
  cancel: "CANCELLED",
  expire: "EXPIRED",
  refund: "REFUNDED",
};

const ORDER_STATUS_MAP: Record<string, string | null> = {
  capture: "PAID",
  settlement: "PAID",
  pending: null, // no-op — order stays PENDING_PAYMENT
  deny: "CANCELLED", // was "FAILED" — invalid OrderStatus → 422
  cancel: "CANCELLED",
  expire: "CANCELLED", // was "EXPIRED" — invalid OrderStatus → 422
  refund: "REFUNDED",
};

export const webhookHandler = async (c: Context<AppEnv>) => {
  // Body is forwarded intact by api-gateway after the GW-04 fix (body cached
  // in context.webhookRawBody and re-used by the proxy before forwarding).
  const notification = await c.req.json<MidtransNotification>();
  // Propagate the trace ID injected by the gateway, or generate a fresh one
  // for direct Midtrans webhook calls that don't carry an x-request-id.
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();

  const program = Effect.gen(function* () {
    const txStatus = notification.transaction_status ?? "";
    const paymentStatus = PAYMENT_STATUS_MAP[txStatus] ?? "UNKNOWN";
    const orderStatus = ORDER_STATUS_MAP[txStatus]; // null = skip

    // ── FIX PAY-05: Idempotency guard ────────────────────────────────────────
    // Midtrans may deliver the same notification more than once. Fetch the
    // current payment record before applying any changes. If the record already
    // has the same target status, skip all side-effects (stock release, email
    // jobs) and ACK immediately — the event was already processed.
    //
    // We use Effect.either so that PaymentNotFoundError (first-time webhook
    // before initiate has run) is treated as "not yet processed" rather than
    // crashing the flow.
    const existingResult = yield* paymentRepository
      .findByOrderId(notification.order_id)
      .pipe(Effect.either);

    const existingStatus =
      existingResult._tag === "Right" ? existingResult.right.status : null;

    if (existingStatus === paymentStatus) {
      console.info(
        JSON.stringify({
          event: "webhook_duplicate_skipped",
          orderId: notification.order_id,
          txStatus,
          paymentStatus,
          note: "Status already matches — skipping side effects",
        })
      );
      return { received: true };
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── FIX PAY-06: Amount integrity check ───────────────────────────────────
    // Midtrans sends gross_amount as a decimal string (e.g. "150000.00").
    // Compare it against the amount stored in the DB at initiation time.
    // A mismatch signals a tampered notification or a mis-routed event from a
    // different transaction — reject all side effects and ACK 200 so Midtrans
    // stops retrying.  Only checked when a payment record already exists; a
    // missing record (Left) means initiate has not run yet, so there is no
    // authoritative amount to compare against.
    if (existingResult._tag === "Right") {
      const notificationAmount = Math.round(
        parseFloat(notification.gross_amount ?? "0")
      );
      const dbAmount = existingResult.right.amount;

      if (notificationAmount !== dbAmount) {
        console.error(
          JSON.stringify({
            event: "ALERT_PAYMENT_AMOUNT_MISMATCH",
            severity: "CRITICAL",
            orderId: notification.order_id,
            dbAmount,
            notificationAmount,
            grossAmountRaw: notification.gross_amount,
            txStatus,
            note: "Rejecting webhook — gross_amount does not match stored payment amount. Possible tampered notification.",
          })
        );
        return { received: true };
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Update payment record (status + paymentType + paidAt)
    const payment = yield* paymentRepository.updateByOrderId(
      notification.order_id,
      {
        status: paymentStatus,
        paymentType: notification.payment_type,
        paidAt: paymentStatus === "PAID" ? new Date() : undefined,
      }
    );

    // 2. Sync order-service — only when there is a meaningful order status change
    if (orderStatus !== null) {
      yield* orderClient.updateStatus(notification.order_id, orderStatus, requestId);
    }

    // 3. Side effects — enqueue email jobs (fire-and-forget via BullMQ)
    //    userEmail comes from the payment record's associated user.
    //    If the user email is not stored on the payment, the email-worker will
    //    fall back to fetching it from auth-service using the userId.
    const userEmail = payment.userEmail ?? "";

    if (paymentStatus === "PAID") {
      yield* emailQueue.add("order-confirmation", {
        orderId: notification.order_id,
        userEmail,
        amount: payment.amount,
      });
    }

    if (
      paymentStatus === "EXPIRED" ||
      paymentStatus === "CANCELLED" ||
      paymentStatus === "FAILED"
    ) {
      yield* orderClient.releaseStock(notification.order_id, requestId);

      yield* emailQueue.addCancelled({
        orderId: notification.order_id,
        userEmail,
        reason: paymentStatus,
      });
    }

    return { received: true };
  });

  const result = await Effect.runPromiseExit(program);

  // Always return 200 to Midtrans — if we 5xx it retries indefinitely.
  if (result._tag === "Failure") {
    console.error(
      JSON.stringify({
        event: "webhook_processing_failed",
        orderId: notification?.order_id,
        txStatus: notification?.transaction_status,
        cause: String(result.cause),
      })
    );
    return c.json({ received: false }, 200);
  }

  return c.json(result.value, 200);
};

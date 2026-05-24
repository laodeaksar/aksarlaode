import { Effect } from "effect";

import type { Context } from "elysia";

import { env } from "@repo/env/order";

import { shapeOrder } from "@/lib/shape-order";
import {
  InvalidTransitionError,
  orderRepository,
  VALID_TRANSITIONS,
} from "@/repository/order.repository";
import type { UpdateStatusBody } from "@/types";
import type { OrderStatus } from "@/types";

// FIX ORD-01: VALID_TRANSITIONS is the single canonical state machine, imported
// from order.repository — not redeclared here. Handlers use it only to produce
// detailed user-facing error messages; the repository enforces the rule on every
// DB write.
//
// Rationale per transition:
//   PENDING_PAYMENT → PAID        payment confirmed (manual override)
//   PENDING_PAYMENT → CANCELLED   payment not received, admin cancels
//   PAID            → PROCESSING  warehouse picks up the order
//   PAID            → CANCELLED   admin cancels before processing (refund pending)
//   PAID            → REFUNDED    direct refund without fulfilment
//   PROCESSING      → SHIPPED     handover to courier
//   PROCESSING      → CANCELLED   cancelled during packing
//   SHIPPED         → DELIVERED   confirmed delivery
//   SHIPPED         → CANCELLED   return in transit (rare)
//   DELIVERED       → REFUNDED    post-delivery refund
//   CANCELLED       → (none)      terminal state
//   REFUNDED        → (none)      terminal state

export const updateStatusHandler = async ({
  params,
  body,
  headers,
  set,
}: Context) => {
  const { orderId } = params as { orderId: string };
  const { status, note } = body as UpdateStatusBody;

  // ── Authorization — admin role OR trusted internal service only ──────────
  const role = headers["x-user-role"];
  const serviceToken = headers["x-service-token"];
  const isAdmin = role === "ADMIN" || role === "OWNER";
  const isInternalCall = serviceToken === env.INTERNAL_SERVICE_TOKEN;

  if (!isAdmin && !isInternalCall) {
    set.status = 403;
    return { error: "Forbidden", code: "FORBIDDEN" };
  }

  // Track who made the change for audit log
  const userId = headers["x-user-id"];
  const changedBy =
    isInternalCall && !userId ? "service:internal" : (userId ?? "unknown");

  // ── Fetch current order to validate state transition ─────────────────────
  const findResult = await Effect.runPromiseExit(
    orderRepository.findByOrderId(orderId)
  );

  if (findResult._tag === "Failure") {
    set.status = 404;
    return { error: "Order not found", code: "ORDER_NOT_FOUND" };
  }

  const currentStatus = findResult.value.status as OrderStatus;
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    // currentStatus is a terminal state (CANCELLED or REFUNDED)
    set.status = 409;
    return {
      error: `Order is in terminal state '${currentStatus}' and cannot be updated`,
      code: "INVALID_STATUS_TRANSITION",
    };
  }

  if (!allowed.has(status as OrderStatus)) {
    set.status = 422;
    return {
      error: `Transition '${currentStatus}' → '${status}' is not allowed. Valid: [${[...allowed].join(", ")}]`,
      code: "INVALID_STATUS_TRANSITION",
    };
  }

  // ── Apply the valid transition ────────────────────────────────────────────
  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(
      orderId,
      status as OrderStatus,
      note,
      changedBy
    )
  );

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string };
    if (
      err._tag === "OrderNotFoundError" ||
      err._tag === "InvalidTransitionError"
    ) {
      set.status = 404;
      return { error: "Order not found", code: "ORDER_NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Failed to update status" };
  }

  return shapeOrder(result.value as Record<string, any>);
};

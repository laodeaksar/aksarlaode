import { Effect }          from "effect"
import type { Context }    from "elysia"
import { env }             from "@repo/env/order"
import { orderRepository } from "@/repository/order.repository"
import { shapeOrder }      from "@/lib/shape-order"
import type { UpdateStatusBody } from "@/types"
import type { OrderStatus } from "@/models/order.model"

// FIX ORD-01: explicit state machine — only valid forward transitions are
// permitted. Prevents admin from accidentally or maliciously moving an order
// backwards (e.g. DELIVERED → PENDING_PAYMENT) or skipping stages.
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
const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID:            ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING:      ["SHIPPED", "CANCELLED"],
  SHIPPED:         ["DELIVERED", "CANCELLED"],
  DELIVERED:       ["REFUNDED"],
}

export const updateStatusHandler = async ({ params, body, headers, set }: Context) => {
  const { orderId }      = params as { orderId: string }
  const { status, note } = body as UpdateStatusBody

  // ── Authorization — admin role OR trusted internal service only ──────────
  const role           = headers["x-user-role"]
  const serviceToken   = headers["x-service-token"]
  const isAdmin        = role === "ADMIN" || role === "OWNER"
  const isInternalCall = serviceToken === env.INTERNAL_SERVICE_TOKEN

  if (!isAdmin && !isInternalCall) {
    set.status = 403
    return { error: "Forbidden", code: "FORBIDDEN" }
  }

  // Track who made the change for audit log
  const userId    = headers["x-user-id"]
  const changedBy = isInternalCall && !userId
    ? "service:internal"
    : (userId ?? "unknown")

  // ── Fetch current order to validate state transition ─────────────────────
  const findResult = await Effect.runPromiseExit(orderRepository.findByOrderId(orderId))

  if (findResult._tag === "Failure") {
    set.status = 404
    return { error: "Order not found", code: "ORDER_NOT_FOUND" }
  }

  const currentStatus = findResult.value.status as OrderStatus
  const allowed       = VALID_TRANSITIONS[currentStatus]

  if (!allowed) {
    // currentStatus is a terminal state (CANCELLED or REFUNDED)
    set.status = 409
    return {
      error: `Order is in terminal state '${currentStatus}' and cannot be updated`,
      code:  "INVALID_STATUS_TRANSITION",
    }
  }

  if (!allowed.includes(status as OrderStatus)) {
    set.status = 422
    return {
      error: `Transition '${currentStatus}' → '${status}' is not allowed. Valid: [${allowed.join(", ")}]`,
      code:  "INVALID_STATUS_TRANSITION",
    }
  }

  // ── Apply the valid transition ────────────────────────────────────────────
  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(orderId, status as OrderStatus, note, changedBy)
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") {
      set.status = 404
      return { error: "Order not found", code: "ORDER_NOT_FOUND" }
    }
    set.status = 500
    return { error: "Failed to update status" }
  }

  return shapeOrder(result.value as Record<string, any>)
}

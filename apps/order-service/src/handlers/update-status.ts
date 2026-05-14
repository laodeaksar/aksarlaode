import { Effect }          from "effect"
import type { Context }    from "elysia"
import { env }             from "@repo/env/order"
import { orderRepository } from "@/repository/order.repository"
import type { UpdateStatusBody } from "@/types"

export const updateStatusHandler = async ({ params, body, headers, set }: Context) => {
  const { orderId }      = params as { orderId: string }
  const { status, note } = body as UpdateStatusBody

  // ── Authorization — admin role OR trusted internal service only ──────────
  const role            = headers["x-user-role"]
  const serviceToken    = headers["x-service-token"]
  const isAdmin         = role === "ADMIN"
  const isInternalCall  = serviceToken === env.INTERNAL_SERVICE_TOKEN

  if (!isAdmin && !isInternalCall) {
    set.status = 403
    return { error: "Forbidden", code: "FORBIDDEN" }
  }

  // Track who made the change for audit log
  const userId    = headers["x-user-id"]
  const changedBy = isInternalCall && !userId
    ? "service:internal"
    : (userId ?? "unknown")

  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(orderId, status, note, changedBy)
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") { set.status = 404; return { error: "Order not found" } }
    set.status = 500
    return { error: "Failed to update status" }
  }

  return result.value
}

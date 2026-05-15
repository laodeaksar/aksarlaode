import { Effect }          from "effect"
import type { Context }    from "elysia"
import { orderRepository } from "@/repository/order.repository"
import { shapeOrder }      from "@/lib/shape-order"

export const cancelHandler = async ({ params, headers, set }: Context) => {
  const { orderId } = params as { orderId: string }
  const userId      = headers["x-user-id"]!

  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const order = yield* orderRepository.checkOwnership(orderId, userId)

      if (order.status !== "PENDING_PAYMENT" && order.status !== "PAID") {
        return yield* Effect.fail({ _tag: "ConflictError" as const })
      }

      return yield* orderRepository.updateStatus(orderId, "CANCELLED")
    })
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError")                                { set.status = 404; return { error: "Order not found",                            code: "ORDER_NOT_FOUND" } }
    if (err._tag === "OrderConflictError" || err._tag === "ConflictError") { set.status = 409; return { error: "Cannot cancel order in its current status", code: "INVALID_STATUS_TRANSITION" } }
    set.status = 500
    return { error: "Failed to cancel order" }
  }

  const shaped = shapeOrder(result.value as Record<string, any>)

  // Sanity-check: cancellation must always produce a cancelledAt timestamp
  if (!shaped.cancelledAt) {
    console.error(JSON.stringify({
      event:   "cancel_missing_cancelledAt",
      orderId,
      status:  shaped.status,
    }))
  }

  return shaped
}

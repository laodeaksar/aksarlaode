import { orderRepository } from "@/repository/order.repository"
import { Effect } from "effect"
import type { Context } from "elysia"

import { shapeOrder } from "@/lib/shape-order"

export const getOneHandler = async ({ params, headers, set }: Context) => {
  const { orderId } = params as { orderId: string }
  const userId = headers["x-user-id"]!
  const role = headers["x-user-role"]

  // Admins may view any order; regular users are gated by ownership check
  const program =
    role === "ADMIN"
      ? orderRepository.findByOrderId(orderId)
      : orderRepository.checkOwnership(orderId, userId)

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") {
      set.status = 404
      return { error: "Order not found", code: "ORDER_NOT_FOUND" }
    }
    // Return 404 (not 403) to avoid leaking whether the order exists
    if (err._tag === "OrderConflictError") {
      set.status = 404
      return { error: "Order not found", code: "ORDER_NOT_FOUND" }
    }
    set.status = 500
    return { error: "Failed to fetch order" }
  }

  return shapeOrder(result.value as Record<string, any>)
}

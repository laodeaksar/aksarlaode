import { Effect }          from "effect"
import type { Context }    from "elysia"
import { orderRepository } from "@/repository/order.repository"

export const getOneHandler = async ({ params, headers, set }: Context) => {
  const { orderId } = params as { orderId: string }
  const userId      = headers["x-user-id"]!
  const role        = headers["x-user-role"]

  const program = role === "ADMIN"
    ? orderRepository.findByOrderId(orderId)
    : orderRepository.checkOwnership(orderId, userId)

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") { set.status = 404; return { error: "Order not found" } }
    if (err._tag === "OrderConflictError") { set.status = 403; return { error: "Forbidden" } }
    set.status = 500
    return { error: "Failed to fetch order" }
  }

  return result.value
}

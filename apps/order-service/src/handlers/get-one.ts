import { Effect } from "effect"
import type { Context } from "hono"
import { orderRepository } from "@/repository/order.repository"
import type { AppEnv } from "@/types"

export const getOneHandler = async (c: Context<AppEnv>) => {
  const orderId = c.req.param("orderId")
  const userId  = c.req.header("x-user-id")!
  const role    = c.req.header("x-user-role")

  const program = role === "ADMIN"
    ? orderRepository.findByOrderId(orderId)
    : orderRepository.checkOwnership(orderId, userId)

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError")  return c.json({ error: "Order not found" }, 404)
    if (err._tag === "OrderConflictError")  return c.json({ error: "Forbidden" }, 403)
    return c.json({ error: "Failed to fetch order" }, 500)
  }

  return c.json(result.value)
}

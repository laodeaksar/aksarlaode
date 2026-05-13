import { Effect } from "effect"
import type { Context } from "hono"
import { orderRepository } from "../repository/order.repository"
import type { AppEnv } from "../types"

export const cancelHandler = async (c: Context<AppEnv>) => {
  const orderId = c.req.param("orderId")
  const userId  = c.req.header("x-user-id")!

  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const order = yield* orderRepository.checkOwnership(orderId, userId)
      if (order.status !== "PENDING" && order.status !== "PAID") {
        return yield* Effect.fail({ _tag: "ConflictError" as const })
      }
      return yield* orderRepository.updateStatus(orderId, "CANCELLED")
    })
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") return c.json({ error: "Order not found" }, 404)
    if (err._tag === "OrderConflictError" || err._tag === "ConflictError") return c.json({ error: "Cannot cancel order" }, 409)
    return c.json({ error: "Failed to cancel order" }, 500)
  }

  return c.json(result.value)
}

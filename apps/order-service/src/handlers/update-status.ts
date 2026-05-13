import { Effect } from "effect"
import type { Context } from "hono"
import { orderRepository } from "@/repository/order.repository"
import type { AppEnv } from "@/types"

export const updateStatusHandler = async (c: Context<AppEnv>) => {
  const orderId = c.req.param("orderId")
  const { status, note } = await c.req.json()

  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(orderId, status, note)
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") return c.json({ error: "Order not found" }, 404)
    return c.json({ error: "Failed to update status" }, 500)
  }

  return c.json(result.value)
}

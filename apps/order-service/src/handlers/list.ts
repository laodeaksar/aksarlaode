import { Effect } from "effect"
import type { Context } from "hono"
import { orderRepository } from "../repository/order.repository"
import type { AppEnv } from "../types"

export const listHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")!
  const page   = Number(c.req.query("page")  ?? 1)
  const limit  = Number(c.req.query("limit") ?? 20)

  const result = await Effect.runPromiseExit(
    orderRepository.findByUser(userId, page, limit)
  )

  if (result._tag === "Failure") {
    return c.json({ error: "Failed to fetch orders" }, 500)
  }

  return c.json(result.value)
}

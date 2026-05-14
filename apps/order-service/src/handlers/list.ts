import { Effect }          from "effect"
import type { Context }    from "elysia"
import { orderRepository } from "@/repository/order.repository"

export const listHandler = async ({ query, headers, set }: Context) => {
  const userId = headers["x-user-id"]!
  const q      = query as { page?: string; limit?: string }
  const page   = Number(q.page  ?? 1)
  const limit  = Math.min(Number(q.limit ?? 20), 100)

  const result = await Effect.runPromiseExit(
    orderRepository.findByUser(userId, page, limit)
  )

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to fetch orders" }
  }

  return result.value
}

import { Effect }          from "effect"
import type { Context }    from "elysia"
import { orderRepository } from "@/repository/order.repository"
import type { UpdateStatusBody } from "@/types"

export const updateStatusHandler = async ({ params, body, set }: Context) => {
  const { orderId }      = params as { orderId: string }
  const { status, note } = body as UpdateStatusBody

  const result = await Effect.runPromiseExit(
    orderRepository.updateStatus(orderId, status, note)
  )

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") { set.status = 404; return { error: "Order not found" } }
    set.status = 500
    return { error: "Failed to update status" }
  }

  return result.value
}

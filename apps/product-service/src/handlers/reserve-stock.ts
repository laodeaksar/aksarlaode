import { Effect, Cause } from "effect"
import type { Context }  from "elysia"
import { productRepository } from "@/repository/product.repository"

export const reserveStockHandler = async ({ params, body, set }: Context) => {
  const { id }       = params
  const { quantity } = body as { quantity: number }

  const result = await Effect.runPromiseExit(
    productRepository.reserveStock(id, quantity)
  )

  if (result._tag === "Failure") {
    const cause = result.cause

    if (Cause.isFailType(cause)) {
      const err = cause.error as any

      if (err._tag === "ProductNotFoundError") {
        set.status = 404
        return { error: "Product not found" }
      }

      if (err._tag === "InsufficientStockError") {
        set.status = 409
        return {
          error: `Insufficient stock: requested ${err.requested}, available ${err.available}`,
          code:  "INSUFFICIENT_STOCK",
        }
      }
    }

    set.status = 500
    return { error: "Internal server error" }
  }

  // Fetch updated stock after successful reservation
  const updated = await Effect.runPromiseExit(productRepository.findById(id))
  const remainingStock = updated._tag === "Success" ? updated.value.stock : null

  return { productId: id, reserved: quantity, remainingStock }
}

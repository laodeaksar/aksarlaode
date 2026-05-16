import { Effect, Cause } from "effect"
import type { Context }  from "elysia"
import { productRepository } from "@/repository/product.repository"

export const releaseStockHandler = async ({ params, body, set }: Context) => {
  const { id }       = params
  const { quantity } = body as { quantity: number }

  // FIX PRD-02: reject zero/negative quantities — releasing 0 is a no-op that
  // hides bugs, and releasing a negative value would silently reduce stock.
  if (!Number.isInteger(quantity) || quantity < 1) {
    set.status = 422
    return { error: "quantity must be a positive integer", code: "INVALID_QUANTITY" }
  }

  // Verify product exists before releasing
  const productResult = await Effect.runPromiseExit(productRepository.findById(id))

  if (productResult._tag === "Failure") {
    set.status = 404
    return { error: "Product not found" }
  }

  const releaseResult = await Effect.runPromiseExit(
    productRepository.releaseStock(id, quantity)
  )

  if (releaseResult._tag === "Failure") {
    set.status = 500
    return { error: "Internal server error" }
  }

  // Fetch updated stock after release
  const updated = await Effect.runPromiseExit(productRepository.findById(id))
  const remainingStock = updated._tag === "Success" ? updated.value.stock : null

  return { productId: id, released: quantity, remainingStock }
}

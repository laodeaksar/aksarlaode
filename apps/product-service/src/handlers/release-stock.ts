import { Effect, Cause } from "effect"
import type { Context }  from "elysia"
import { productRepository } from "@/repository/product.repository"

export const releaseStockHandler = async ({ params, body, set }: Context) => {
  const { id }       = params
  const { quantity } = body as { quantity: number }

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

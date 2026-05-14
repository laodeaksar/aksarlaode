import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"

export const getStockHandler = async ({ params, set }: Context) => {
  const { id } = params

  const result = await Effect.runPromiseExit(productRepository.findById(id))

  if (result._tag === "Failure") {
    set.status = 404
    return { error: "Product not found" }
  }

  const { stock } = result.value

  return {
    productId: id,
    stock,
    inStock: stock > 0,
  }
}

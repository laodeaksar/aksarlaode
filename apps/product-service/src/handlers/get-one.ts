import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"

export const getOneHandler = async ({ params, set }: Context) => {
  const idOrSlug = params.id

  const result = await Effect.runPromiseExit(productRepository.findByIdOrSlug(idOrSlug))

  if (result._tag === "Failure") {
    set.status = 404
    return { error: "Product not found" }
  }

  return result.value
}

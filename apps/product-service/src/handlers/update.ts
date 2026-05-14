import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"

export const updateHandler = async ({ params, body, set }: Context) => {
  const id = params.id

  const result = await Effect.runPromiseExit(productRepository.update(id, body))

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to update product" }
  }

  return result.value
}

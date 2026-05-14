import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"

export const createHandler = async ({ body, set }: Context) => {
  const result = await Effect.runPromiseExit(productRepository.create(body))

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to create product" }
  }

  set.status = 201
  return result.value
}

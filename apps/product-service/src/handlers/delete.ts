import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"

export const deleteHandler = async ({ params, set }: Context) => {
  const id = params.id

  const result = await Effect.runPromiseExit(productRepository.deleteById(id))

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to delete product" }
  }

  return { message: "Deleted" }
}

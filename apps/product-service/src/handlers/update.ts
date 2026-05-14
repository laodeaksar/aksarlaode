import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"
import type { DerivedContext } from "@/types"

export const updateHandler = async ({ params, body, set, userRole }: Context & DerivedContext) => {
  if (userRole !== "ADMIN") {
    set.status = 403
    return { error: "Forbidden: ADMIN role required", code: "FORBIDDEN" }
  }

  const id = params.id

  const result = await Effect.runPromiseExit(productRepository.update(id, body))

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to update product" }
  }

  return result.value
}

import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"
import type { DerivedContext } from "@/types"

export const updateHandler = async ({ params, body, set, userRole, userId, requestId }: Context & DerivedContext) => {
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

  console.info(JSON.stringify({
    event:      "product_updated",
    productId:  id,
    fields:     Object.keys(body as object),
    userId,
    requestId,
  }))

  return result.value
}

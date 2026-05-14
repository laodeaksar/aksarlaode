import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository } from "@/repository/product.repository"
import type { DerivedContext } from "@/types"

export const createHandler = async ({ body, set, userRole, userId, requestId }: Context & DerivedContext) => {
  if (userRole !== "ADMIN") {
    set.status = 403
    return { error: "Forbidden: ADMIN role required", code: "FORBIDDEN" }
  }

  const result = await Effect.runPromiseExit(productRepository.create(body))

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to create product" }
  }

  console.info(JSON.stringify({
    event:      "product_created",
    productId:  result.value.id,
    userId,
    requestId,
  }))

  set.status = 201
  return result.value
}

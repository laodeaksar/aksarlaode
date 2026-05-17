import { productRepository } from "@/repository/product.repository"
import type { DerivedContext } from "@/types"
import { Effect } from "effect"
import type { Context } from "elysia"

export const createHandler = async ({
  body,
  set,
  userRole,
  userId,
  requestId,
}: Context & DerivedContext) => {
  if (userRole !== "ADMIN") {
    set.status = 403
    return { error: "Forbidden: ADMIN role required", code: "FORBIDDEN" }
  }

  const data = body as Record<string, unknown>

  // FIX PRD-06b: price must be a positive integer (stored as smallest currency unit).
  // A zero or negative price would allow free/negative-value orders downstream.
  if (typeof data.price !== "number" || data.price <= 0) {
    set.status = 422
    return { error: "Price must be a positive number", code: "INVALID_PRICE" }
  }

  const result = await Effect.runPromiseExit(productRepository.create(body))

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to create product" }
  }

  console.info(
    JSON.stringify({
      event: "product_created",
      productId: result.value.id,
      userId,
      requestId,
    })
  )

  set.status = 201
  return result.value
}

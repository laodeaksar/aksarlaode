import { Effect, Cause } from "effect"
import type { Context } from "elysia"
import { productRepository, ProductNotFoundError } from "@/repository/product.repository"
import type { DerivedContext } from "@/types"

export const deleteHandler = async ({ params, set, userRole, userId, requestId }: Context & DerivedContext) => {
  if (userRole !== "ADMIN") {
    set.status = 403
    return { error: "Forbidden: ADMIN role required", code: "FORBIDDEN" }
  }

  const id = params.id

  const result = await Effect.runPromiseExit(productRepository.deleteById(id))

  if (result._tag === "Failure") {
    // FIX PRD-01b: propagate ProductNotFoundError as 404, not generic 500.
    const err = Cause.failureOption(result.cause)
    if (err._tag === "Some" && err.value instanceof ProductNotFoundError) {
      set.status = 404
      return { error: "Product not found", code: "PRODUCT_NOT_FOUND" }
    }
    set.status = 500
    return { error: "Failed to delete product" }
  }

  console.info(JSON.stringify({
    event:      "product_deleted",
    productId:  id,
    userId,
    requestId,
  }))

  return { message: "Deleted" }
}

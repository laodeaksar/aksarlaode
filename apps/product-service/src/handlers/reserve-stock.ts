import { productRepository } from "@/repository/product.repository"
import { Cause, Effect } from "effect"
import type { Context } from "elysia"

// Slug format: lowercase letters, digits, and hyphens only.
// Matches the slug generation logic in the product creation handler.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const reserveStockHandler = async ({ params, body, set }: Context) => {
  const { id } = params
  const { quantity } = body as { quantity: number }

  // FIX PRD-02: reject zero/negative quantities before touching the DB.
  // Without this guard, UPDATE stock = stock - 0 silently succeeds (no-op),
  // and UPDATE stock = stock - (-5) would silently ADD stock — both corrupt
  // inventory without raising an error.
  if (!Number.isInteger(quantity) || quantity < 1) {
    set.status = 422
    return {
      error: "quantity must be a positive integer",
      code: "INVALID_QUANTITY",
    }
  }

  const result = await Effect.runPromiseExit(
    productRepository.reserveStock(id, quantity)
  )

  if (result._tag === "Failure") {
    const cause = result.cause

    if (Cause.isFailType(cause)) {
      const err = cause.error as any

      if (err._tag === "ProductNotFoundError") {
        set.status = 404
        return { error: "Product not found" }
      }

      if (err._tag === "InsufficientStockError") {
        set.status = 409
        return {
          error: `Insufficient stock: requested ${err.requested}, available ${err.available}`,
          code: "INSUFFICIENT_STOCK",
        }
      }
    }

    set.status = 500
    return { error: "Internal server error" }
  }

  // Fetch updated stock after successful reservation
  const updated = await Effect.runPromiseExit(productRepository.findById(id))
  const remainingStock = updated._tag === "Success" ? updated.value.stock : null

  return { productId: id, reserved: quantity, remainingStock }
}

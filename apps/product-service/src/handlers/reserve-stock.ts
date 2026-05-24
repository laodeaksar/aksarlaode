import { Cause, Effect } from "effect";

import type { Context } from "elysia";

import {
  InsufficientStockError,
  ProductNotFoundError,
  productRepository,
} from "@/repository/product.repository";

export const reserveStockHandler = async ({ params, body, set }: Context) => {
  const id = params.id ?? "";
  const { quantity } = body as { quantity: number };

  const result = await Effect.runPromiseExit(
    productRepository.reserveStock(id, quantity)
  );

  if (result._tag === "Failure") {
    const err = Cause.failureOption(result.cause);

    if (err._tag === "Some") {
      if (err.value instanceof ProductNotFoundError) {
        set.status = 404;
        return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
      }

      if (err.value instanceof InsufficientStockError) {
        set.status = 409;
        return {
          error: `Insufficient stock: requested ${err.value.requested}, available ${err.value.available}`,
          code: "INSUFFICIENT_STOCK",
        };
      }
    }

    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  }

  const updated = await Effect.runPromiseExit(productRepository.findById(id));
  const remainingStock =
    updated._tag === "Success" ? updated.value.stock : null;

  return { productId: id, reserved: quantity, remainingStock };
};

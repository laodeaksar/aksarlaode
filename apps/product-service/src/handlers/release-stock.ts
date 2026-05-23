import { Cause, Effect } from "effect";

import type { Context } from "elysia";

import {
  ProductNotFoundError,
  productRepository,
} from "@/repository/product.repository";

export const releaseStockHandler = async ({ params, body, set }: Context) => {
  const { id } = params;
  const { quantity } = body as { quantity: number };

  // Verify product exists before releasing stock.
  const productResult = await Effect.runPromiseExit(
    productRepository.findById(id)
  );

  if (productResult._tag === "Failure") {
    const err = Cause.failureOption(productResult.cause);
    if (err._tag === "Some" && err.value instanceof ProductNotFoundError) {
      set.status = 404;
      return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  }

  const releaseResult = await Effect.runPromiseExit(
    productRepository.releaseStock(id, quantity)
  );

  if (releaseResult._tag === "Failure") {
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  }

  // Fetch updated stock after release.
  const updated = await Effect.runPromiseExit(productRepository.findById(id));
  const remainingStock =
    updated._tag === "Success" ? updated.value.stock : null;

  return { productId: id, released: quantity, remainingStock };
};

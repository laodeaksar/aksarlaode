import { Cause, Effect } from "effect";

import type { Context } from "elysia";

import {
  ProductNotFoundError,
  productRepository,
} from "@/repository/product.repository";

export const getStockHandler = async ({ params, set }: Context) => {
  const { id } = params;

  const result = await Effect.runPromiseExit(productRepository.findById(id));

  if (result._tag === "Failure") {
    const err = Cause.failureOption(result.cause);
    if (err._tag === "Some" && err.value instanceof ProductNotFoundError) {
      set.status = 404;
      return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  }

  const { stock } = result.value;

  return {
    productId: id,
    stock,
    inStock: stock > 0,
  };
};

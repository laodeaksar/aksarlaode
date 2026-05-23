import { Cause, Effect } from "effect";

import type { Context } from "elysia";

import {
  ProductNotFoundError,
  productRepository,
} from "@/repository/product.repository";
import type { DerivedContext } from "@/types";

export const updateHandler = async ({
  params,
  body,
  set,
  userRole,
  userId,
  requestId,
}: Context & DerivedContext) => {
  if (userRole !== "ADMIN") {
    set.status = 403;
    return { error: "Forbidden: ADMIN role required", code: "FORBIDDEN" };
  }

  const id = params.id ?? "";
  const data = body as Record<string, unknown>;

  // FIX PRD-06b: reject zero or negative price before touching the DB.
  if (
    data.price !== undefined &&
    (typeof data.price !== "number" || data.price <= 0)
  ) {
    set.status = 422;
    return { error: "Price must be a positive number", code: "INVALID_PRICE" };
  }

  const result = await Effect.runPromiseExit(
    productRepository.update(id, data as Parameters<(typeof productRepository)["update"]>[1])
  );

  if (result._tag === "Failure") {
    // FIX PRD-01b: propagate ProductNotFoundError as 404, not generic 500.
    const err = Cause.failureOption(result.cause);
    if (err._tag === "Some" && err.value instanceof ProductNotFoundError) {
      set.status = 404;
      return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Failed to update product", code: "INTERNAL_ERROR" };
  }

  console.info(
    JSON.stringify({
      event: "product_updated",
      productId: id,
      fields: Object.keys(data),
      userId,
      requestId,
    })
  );

  return result.value;
};

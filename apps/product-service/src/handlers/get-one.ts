import { Cause, Effect } from "effect";

import type { Context } from "elysia";

import {
  ProductNotFoundError,
  productRepository,
} from "@/repository/product.repository";

// ── Input validation ───────────────────────────────────────────────────────
// FIX PRD-03: validate slug format before it reaches the DB layer.
// Valid slug: lowercase letters, digits, hyphens. No path traversal (../),
// null bytes, or special characters that could cause log injection or
// unexpected query behaviour. Max 120 chars prevents DoS via long strings.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 120;

function isValidInput(idOrSlug: string): boolean {
  if (!idOrSlug || idOrSlug.length > SLUG_MAX) return false;
  if (UUID_REGEX.test(idOrSlug)) return true;
  return SLUG_REGEX.test(idOrSlug);
}

export const getOneHandler = async ({ params, set }: Context) => {
  const idOrSlug = params.id;

  if (!isValidInput(idOrSlug)) {
    set.status = 400;
    return { error: "Invalid product identifier", code: "INVALID_IDENTIFIER" };
  }

  const result = await Effect.runPromiseExit(
    productRepository.findByIdOrSlug(idOrSlug)
  );

  if (result._tag === "Failure") {
    const err = Cause.failureOption(result.cause);
    if (err._tag === "Some" && err.value instanceof ProductNotFoundError) {
      set.status = 404;
      return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
    }
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  }

  return result.value;
};

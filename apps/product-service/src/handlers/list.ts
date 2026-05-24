import { Effect } from "effect";

import type { Context } from "elysia";

import { type ProductFilters } from "@/lib/query-builder";
import { productRepository } from "@/repository/product.repository";

export const listHandler = async ({ query, set }: Context) => {
  // Elysia has already validated the query shape via ProductListQuerySchema.
  // We only need to coerce string query params into their correct runtime types
  // before passing them to the repository. No secondary validation library needed.
  const filters: ProductFilters = {
    search: query.search,
    categoryId: query.categoryId,
    minPrice: query.minPrice !== undefined ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice !== undefined ? Number(query.maxPrice) : undefined,
    inStock: query.inStock === "true" ? true : undefined,
    sortBy: query.sortBy as ProductFilters["sortBy"],
    page: query.page !== undefined ? Number(query.page) : undefined,
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    cursor: query.cursor,
  };

  const result = await Effect.runPromiseExit(productRepository.list(filters));

  if (result._tag === "Failure") {
    set.status = 500;
    return { error: "Failed to fetch products", code: "INTERNAL_ERROR" };
  }

  return result.value;
};

import { Effect } from "effect"
import type { Context } from "elysia"
import { productRepository }  from "@/repository/product.repository"
import { ProductFiltersSchema } from "@repo/common"

export const listHandler = async ({ query, set }: Context) => {
  const program = Effect.gen(function* () {
    const filters = yield* Effect.try({
      try: () => ProductFiltersSchema.parse({
        ...query,
        minPrice: query.minPrice ? Number(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        page:     query.page     ? Number(query.page)     : undefined,
        limit:    query.limit    ? Number(query.limit)    : undefined,
        inStock:  query.inStock  === "true",
        // FIX PRD-07: pass cursor as-is (string) — undefined if not provided
        cursor:   query.cursor   ? String(query.cursor)   : undefined,
      }),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    return yield* productRepository.list(filters)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    set.status = 422
    return { error: "Failed to fetch products", code: "INTERNAL_ERROR" }
  }

  return result.value
}

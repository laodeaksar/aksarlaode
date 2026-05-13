import { Effect } from "effect"
import type { Context } from "hono"
import { productRepository }  from "@/repository/product.repository"
import { ProductFiltersSchema } from "@repo/common"
import type { AppEnv } from "@/types"

export const listHandler = async (c: Context<AppEnv>) => {
  const query = c.req.query()

  const program = Effect.gen(function* () {
    const filters = yield* Effect.try({
      try:   () => ProductFiltersSchema.parse({
        ...query,
        minPrice: query.minPrice ? Number(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        page:     query.page     ? Number(query.page)     : undefined,
        limit:    query.limit    ? Number(query.limit)    : undefined,
        inStock:  query.inStock  === "true",
      }),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    return yield* productRepository.list(filters)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") return c.json({ error: "Invalid filters" }, 422)

  return c.json(result.value)
}

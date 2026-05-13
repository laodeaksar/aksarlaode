import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq, sql }      from "drizzle-orm"
import { buildProductQuery, type ProductFilters } from "../lib/query-builder"

class ProductNotFoundError extends Data.TaggedError("ProductNotFoundError")<{ id: string }> {}
class DbError              extends Data.TaggedError("DbError")<{ cause: unknown }> {}
class InsufficientStockError extends Data.TaggedError("InsufficientStockError")<{
  productId: string; requested: number; available: number
}> {}

const list = (filters: ProductFilters) =>
  Effect.tryPromise({
    try: async () => {
      const { where, orderBy, limit, offset } = buildProductQuery(filters)

      const [items, [{ count }]] = await Promise.all([
        db.select().from(schema.products).where(where).orderBy(orderBy).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(schema.products).where(where),
      ])

      return { items, total: Number(count), page: filters.page ?? 1, limit }
    },
    catch: (e) => new DbError({ cause: e }),
  })

const findById = (id: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try:   () => db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id }))
    return result[0]
  })

// Atomic stock decrement — prevents overselling
const reserveStock = (productId: string, quantity: number) =>
  Effect.gen(function* () {
    const product = yield* findById(productId)

    if (product.stock < quantity) {
      return yield* Effect.fail(
        new InsufficientStockError({ productId, requested: quantity, available: product.stock })
      )
    }

    yield* Effect.tryPromise({
      try: () =>
        db.update(schema.products)
          .set({ stock: sql`${schema.products.stock} - ${quantity}` })
          .where(
            // double-check in the same UPDATE — atomic guard
            sql`${schema.products.id} = ${productId} AND ${schema.products.stock} >= ${quantity}`
          ),
      catch: (e) => new DbError({ cause: e }),
    })
  })

const releaseStock = (productId: string, quantity: number) =>
  Effect.tryPromise({
    try:   () =>
      db.update(schema.products)
        .set({ stock: sql`${schema.products.stock} + ${quantity}` })
        .where(eq(schema.products.id, productId)),
    catch: (e) => new DbError({ cause: e }),
  })

export const productRepository = { list, findById, reserveStock, releaseStock }

import { Effect, Data } from "effect"
import { db, schema, eq, sql } from "@repo/database"

class StockError extends Data.TaggedError("StockError")<{ reason: string }> {}

export const decrementStock = (productId: string, quantity: number) =>
  Effect.tryPromise({
    try: () =>
      db.update(schema.products)
        .set({ stock: sql`${schema.products.stock} - ${quantity}` })
        .where(eq(schema.products.id, productId))
        .returning()
        .then(r => r[0]!),
    catch: (e) => new StockError({ reason: String(e) }),
  })

export const incrementStock = (productId: string, quantity: number) =>
  Effect.tryPromise({
    try: () =>
      db.update(schema.products)
        .set({ stock: sql`${schema.products.stock} + ${quantity}` })
        .where(eq(schema.products.id, productId))
        .returning()
        .then(r => r[0]!),
    catch: (e) => new StockError({ reason: String(e) }),
  })

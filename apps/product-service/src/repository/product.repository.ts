import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq, or, sql }  from "drizzle-orm"
import { buildProductQuery, type ProductFilters } from "@/lib/query-builder"

// ── Error types ────────────────────────────────────────────────────────────
class ProductNotFoundError extends Data.TaggedError("ProductNotFoundError")<{ id: string }> {}
class DbError              extends Data.TaggedError("DbError")<{ cause: unknown }> {}
class InsufficientStockError extends Data.TaggedError("InsufficientStockError")<{
  productId: string; requested: number; available: number
}> {}

type NewProduct     = typeof schema.products.$inferInsert
type UpdateProduct  = Partial<Omit<NewProduct, "id" | "createdAt">>

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── list ───────────────────────────────────────────────────────────────────
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

// ── findById ───────────────────────────────────────────────────────────────
const findById = (id: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try:   () => db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id }))
    return result[0]
  })

// ── findByIdOrSlug ─────────────────────────────────────────────────────────
// Accepts a UUID or a URL slug. Uses an exact column match to stay index-friendly.
const findByIdOrSlug = (idOrSlug: string) =>
  Effect.gen(function* () {
    const isUuid   = UUID_REGEX.test(idOrSlug)
    const condition = isUuid
      ? eq(schema.products.id,   idOrSlug)
      : eq(schema.products.slug, idOrSlug)

    const result = yield* Effect.tryPromise({
      try:   () => db.select().from(schema.products).where(condition).limit(1),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id: idOrSlug }))
    return result[0]
  })

// ── create ─────────────────────────────────────────────────────────────────
const create = (data: NewProduct) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try:   () => db.insert(schema.products).values(data).returning(),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!result[0]) return yield* Effect.fail(new DbError({ cause: "Insert returned no rows" }))
    return result[0]
  })

// ── update ─────────────────────────────────────────────────────────────────
// Verifies the product exists first so handlers get a clean 404, not a silent no-op.
const update = (id: string, data: UpdateProduct) =>
  Effect.gen(function* () {
    yield* findById(id)

    const result = yield* Effect.tryPromise({
      try: () =>
        db.update(schema.products)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(schema.products.id, id))
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id }))
    return result[0]
  })

// ── deleteById ─────────────────────────────────────────────────────────────
// Verifies the product exists first so handlers return 404 instead of silent success.
const deleteById = (id: string) =>
  Effect.gen(function* () {
    yield* findById(id)

    yield* Effect.tryPromise({
      try:   () => db.delete(schema.products).where(eq(schema.products.id, id)),
      catch: (e) => new DbError({ cause: e }),
    })
  })

// ── Atomic stock operations ────────────────────────────────────────────────
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
            // double-check in the same UPDATE — atomic guard against race conditions
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

// ── Exports ────────────────────────────────────────────────────────────────
export const productRepository = {
  list,
  findById,
  findByIdOrSlug,
  create,
  update,
  deleteById,
  reserveStock,
  releaseStock,
}

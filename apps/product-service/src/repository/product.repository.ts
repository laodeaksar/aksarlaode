import { Effect, Data } from "effect"
import { db, schema }   from "@repo/database"
import { eq, sql }      from "drizzle-orm"
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
const findByIdOrSlug = (idOrSlug: string) =>
  Effect.gen(function* () {
    const isUuid    = UUID_REGEX.test(idOrSlug)
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
const deleteById = (id: string) =>
  Effect.gen(function* () {
    yield* findById(id)

    yield* Effect.tryPromise({
      try:   () => db.delete(schema.products).where(eq(schema.products.id, id)),
      catch: (e) => new DbError({ cause: e }),
    })
  })

// ── reserveStock ───────────────────────────────────────────────────────────
// FIX PRD-01: single atomic UPDATE with RETURNING — no TOCTOU window.
// If WHERE (stock >= quantity) fails because of concurrent reservation, the
// UPDATE touches 0 rows and RETURNING returns an empty array.  We detect that
// and raise InsufficientStockError so the caller never thinks a reservation
// succeeded when it silently did nothing.
const reserveStock = (productId: string, quantity: number) =>
  Effect.gen(function* () {
    const updated = yield* Effect.tryPromise({
      try: () =>
        db.update(schema.products)
          .set({ stock: sql`${schema.products.stock} - ${quantity}` })
          .where(
            sql`${schema.products.id} = ${productId}
                AND ${schema.products.stock} >= ${quantity}`
          )
          .returning({ id: schema.products.id, stock: schema.products.stock }),
      catch: (e) => new DbError({ cause: e }),
    })

    if (updated.length === 0) {
      // Distinguish "product not found" from "not enough stock" for the caller.
      const check = yield* Effect.tryPromise({
        try:   () =>
          db.select({ stock: schema.products.stock })
            .from(schema.products)
            .where(eq(schema.products.id, productId))
            .limit(1),
        catch: (e) => new DbError({ cause: e }),
      })

      if (check.length === 0) {
        return yield* Effect.fail(new ProductNotFoundError({ id: productId }))
      }

      return yield* Effect.fail(
        new InsufficientStockError({
          productId,
          requested: quantity,
          available: check[0]!.stock,
        })
      )
    }

    return updated[0]!
  })

// ── releaseStock ───────────────────────────────────────────────────────────
const releaseStock = (productId: string, quantity: number) =>
  Effect.tryPromise({
    try: () =>
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

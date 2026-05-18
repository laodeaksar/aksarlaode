import { Data, Effect } from "effect";

import { eq, sql } from "drizzle-orm";

import { db, schema } from "@repo/database";

import { cacheKey, productCache } from "@/lib/product-cache";
import { buildProductQuery, type ProductFilters } from "@/lib/query-builder";

// ── Error types ────────────────────────────────────────────────────────────
export class ProductNotFoundError extends Data.TaggedError(
  "ProductNotFoundError"
)<{ id: string }> {}
export class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}
export class InsufficientStockError extends Data.TaggedError(
  "InsufficientStockError"
)<{
  productId: string;
  requested: number;
  available: number;
}> {}

type NewProduct = typeof schema.products.$inferInsert;
type UpdateProduct = Partial<Omit<NewProduct, "id" | "createdAt">>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── list ───────────────────────────────────────────────────────────────────
// FIX PRD-04: filter deleted_at IS NULL so soft-deleted products are excluded.
const list = (filters: ProductFilters) =>
  Effect.tryPromise({
    try: async () => {
      const { where, orderBy, limit, offset, cursor } =
        buildProductQuery(filters);

      const [items, [{ count }]] = await Promise.all([
        db
          .select()
          .from(schema.products)
          .where(where)
          .orderBy(orderBy)
          .limit(limit + 1) // fetch one extra to determine if there's a next page
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.products)
          .where(where),
      ]);

      // FIX PRD-07: cursor-based pagination response
      let nextCursor: string | null = null;
      let pageItems = items;

      if (cursor !== null && items.length > limit) {
        pageItems = items.slice(0, limit);
        const last = pageItems[pageItems.length - 1]!;
        nextCursor = Buffer.from(
          `${last.createdAt.toISOString()}:${last.id}`
        ).toString("base64url");
      }

      return {
        items: pageItems,
        total: Number(count),
        page: filters.page ?? 1,
        limit,
        nextCursor,
      };
    },
    catch: (e) => new DbError({ cause: e }),
  });

// ── findById ───────────────────────────────────────────────────────────────
const findById = (id: string) =>
  Effect.gen(function* () {
    // FIX PRD-05: check in-process cache first
    const cached = productCache.get<typeof schema.products.$inferSelect>(
      cacheKey.byId(id)
    );
    if (cached) return cached;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, id))
          // FIX PRD-04: exclude soft-deleted products
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    // FIX PRD-04: treat soft-deleted rows as not found
    const row = result.find((r) => r.deletedAt == null);
    if (!row) return yield* Effect.fail(new ProductNotFoundError({ id }));

    productCache.set(cacheKey.byId(id), row);
    return row;
  });

// ── findByIdOrSlug ─────────────────────────────────────────────────────────
const findByIdOrSlug = (idOrSlug: string) =>
  Effect.gen(function* () {
    const isUuid = UUID_REGEX.test(idOrSlug);

    // FIX PRD-05: check in-process cache first
    const ck = isUuid ? cacheKey.byId(idOrSlug) : cacheKey.bySlug(idOrSlug);
    const cached = productCache.get<typeof schema.products.$inferSelect>(ck);
    if (cached) return cached;

    const condition = isUuid
      ? eq(schema.products.id, idOrSlug)
      : eq(schema.products.slug, idOrSlug);

    const result = yield* Effect.tryPromise({
      try: () => db.select().from(schema.products).where(condition).limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    // FIX PRD-04: treat soft-deleted rows as not found
    const row = result.find((r) => r.deletedAt == null);
    if (!row)
      return yield* Effect.fail(new ProductNotFoundError({ id: idOrSlug }));

    productCache.set(cacheKey.byId(row.id), row);
    productCache.set(cacheKey.bySlug(row.slug), row);
    return row;
  });

// ── create ─────────────────────────────────────────────────────────────────
const create = (data: NewProduct) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => db.insert(schema.products).values(data).returning(),
      catch: (e) => new DbError({ cause: e }),
    });

    if (!result[0])
      return yield* Effect.fail(
        new DbError({ cause: "Insert returned no rows" })
      );
    return result[0];
  });

// ── update ─────────────────────────────────────────────────────────────────
// FIX PRD-01b: uses RETURNING to detect no-op updates; returns ProductNotFoundError
// when the WHERE clause matches zero rows (product was deleted concurrently).
const update = (id: string, data: UpdateProduct) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.products)
          .set({ ...data, updatedAt: new Date() })
          .where(
            sql`${schema.products.id} = ${id} AND ${schema.products.deletedAt} IS NULL`
          )
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    });

    if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id }));

    // FIX PRD-05: invalidate cache entries for this product
    productCache.invalidate(result[0].id, result[0].slug);

    return result[0];
  });

// ── deleteById ─────────────────────────────────────────────────────────────
// FIX PRD-04: soft-delete — set deleted_at instead of issuing DELETE.
// FIX PRD-01b: RETURNING lets us detect missing rows and return 404.
// FIX PRD-05: invalidate cache after deletion.
const deleteById = (id: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.products)
          .set({ deletedAt: new Date() })
          .where(
            sql`${schema.products.id} = ${id} AND ${schema.products.deletedAt} IS NULL`
          )
          .returning({ id: schema.products.id, slug: schema.products.slug }),
      catch: (e) => new DbError({ cause: e }),
    });

    if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id }));

    // Invalidate cache so subsequent reads don't return the deleted product
    productCache.invalidate(id, result[0].slug);
  });

// ── reserveStock ───────────────────────────────────────────────────────────
// FIX PRD-01: single atomic UPDATE with RETURNING — no TOCTOU window.
// FIX PRD-04: exclude soft-deleted products from stock reservation.
const reserveStock = (productId: string, quantity: number) =>
  Effect.gen(function* () {
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} - ${quantity}` })
          .where(
            sql`${schema.products.id} = ${productId}
                AND ${schema.products.stock} >= ${quantity}
                AND ${schema.products.deletedAt} IS NULL`
          )
          .returning({ id: schema.products.id, stock: schema.products.stock }),
      catch: (e) => new DbError({ cause: e }),
    });

    if (updated.length === 0) {
      const check = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              stock: schema.products.stock,
              deletedAt: schema.products.deletedAt,
            })
            .from(schema.products)
            .where(eq(schema.products.id, productId))
            .limit(1),
        catch: (e) => new DbError({ cause: e }),
      });

      if (check.length === 0 || check[0]!.deletedAt != null) {
        return yield* Effect.fail(new ProductNotFoundError({ id: productId }));
      }

      return yield* Effect.fail(
        new InsufficientStockError({
          productId,
          requested: quantity,
          available: check[0]!.stock,
        })
      );
    }

    // Invalidate cache — stock changed
    productCache.invalidate(productId);
    return updated[0]!;
  });

// ── releaseStock ───────────────────────────────────────────────────────────
const releaseStock = (productId: string, quantity: number) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} + ${quantity}` })
          .where(eq(schema.products.id, productId)),
      catch: (e) => new DbError({ cause: e }),
    });
    // Invalidate cache — stock changed
    productCache.invalidate(productId);
  });

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
};

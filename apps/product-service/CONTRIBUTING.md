# Contributing to `product-service`

Standard patterns wajib untuk semua kontributor. Tujuan: konsistensi codebase agar setiap engineer bisa membaca, debug, dan extend code tanpa harus menebak pattern yang dipakai.

---

## 1. Struktur Folder & Layering

```
src/
├── index.ts              # App entry — CORS, auth middleware, global error handler
├── plugins/              # Elysia plugins (user-context, dll)
├── routes/               # Route definitions + schema attachment
├── handlers/             # Request/response mapping — TIDAK ada DB access langsung
├── repository/           # Semua DB access — WAJIB pakai Effect
├── lib/                  # Pure utilities: cache, query-builder, audit helper
├── schemas.ts            # Semua TypeBox schemas untuk request/response
└── types/                # Shared TypeScript types (DerivedContext, UserRole)
```

### Aturan layering — WAJIB diikuti

```
Request → Handler → Repository → DB
              ↓
            lib/* (utilities, cache, audit)
```

| Layer | Boleh mengakses | TIDAK boleh |
|-------|----------------|-------------|
| `handler` | `repository.*`, `lib/*` | Drizzle `db` langsung |
| `repository` | `db`, `schema`, `lib/product-cache` | HTTP context (`set`, `params`) |
| `lib/*` | `db` (hanya untuk helpers seperti admin-audit) | HTTP context |

> **Aturan**: handler **tidak boleh** melakukan `db.select/insert/update/delete` langsung.
> Semua akses DB harus melalui `repository/product.repository.ts` atau fungsi helper di `lib/`.

---

## 2. Naming Convention

### API Endpoints

| Pattern | Benar | Salah |
|---------|-------|-------|
| Resource plural | `GET /products` | `GET /product` |
| Sub-resource | `GET /products/:id/stock` | `GET /stock/:id` |
| Action pada resource | `POST /products/:id/stock/reserve` | `POST /reserve-stock` |
| Audit log | `POST /products/audit-logs` | `POST /audit` |

### HTTP Methods & Status Codes

| Operasi | Method | Status sukses | Status error umum |
|---------|--------|---------------|-------------------|
| List | `GET` | 200 | 422 |
| Get by ID | `GET` | 200 | 404, 400 |
| Create | `POST` | **201** | 403, 422, 500 |
| Update | `PUT` | 200 | 403, 404, 422, 500 |
| Delete | `DELETE` | 200 | 403, 404, 500 |
| Stock reserve | `POST` | 200 | 404, 409, 422, 500 |
| Stock release | `POST` | 200 | 404, 422, 500 |
| Audit write | `POST` | **202** | 403 |

### Database

- **Tabel**: `snake_case` plural — `products`, `admin_audit_log`
- **Kolom**: `snake_case` — `created_at`, `deleted_at`, `sales_count`
- **Index**: `idx_{table}_{column(s)}` — `idx_products_slug`, `idx_products_category_id`
- **Soft delete**: selalu `deleted_at TIMESTAMP NULL` — tidak boleh hard-delete row product

### File Naming

- Handler: `{action}.ts` — `create.ts`, `get-one.ts`, `reserve-stock.ts`
- Repository: `{resource}.repository.ts`
- Schema: semua di `schemas.ts` (satu file)
- Types: semua di `types/index.ts`

---

## 3. Error Handling

### Pattern Wajib — Effect-TS di Repository

Semua fungsi repository **wajib** mengembalikan `Effect` dengan typed errors:

```ts
// ✅ Benar — typed error via Data.TaggedError
import { Data, Effect } from "effect";

export class ProductNotFoundError extends Data.TaggedError("ProductNotFoundError")<{
  id: string;
}> {}

export class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

const findById = (id: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1),
      catch: (e) => new DbError({ cause: e }),
    });
    const row = result[0];
    if (!row) return yield* Effect.fail(new ProductNotFoundError({ id }));
    return row;
  });

// ❌ Salah — throw langsung dari repository
const findById = async (id: string) => {
  const result = await db.select()...;
  if (!result[0]) throw new Error("Not found"); // JANGAN
};
```

### Pattern Wajib — Error Mapping di Handler

Gunakan `Cause.failureOption` + `instanceof` — **jangan** `as any` + `._tag` string:

```ts
// ✅ Benar — instanceof check, type-safe
import { Cause, Effect } from "effect";
import { ProductNotFoundError, productRepository } from "@/repository/product.repository";

const result = await Effect.runPromiseExit(productRepository.findById(id));

if (result._tag === "Failure") {
  const err = Cause.failureOption(result.cause);
  if (err._tag === "Some" && err.value instanceof ProductNotFoundError) {
    set.status = 404;
    return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
  }
  set.status = 500;
  return { error: "Internal server error", code: "INTERNAL_ERROR" };
}

// ❌ Salah — unsafe cast, breaks type safety
if (Cause.isFailType(cause)) {
  const err = cause.error as any;         // JANGAN
  if (err._tag === "ProductNotFoundError") { ... }
}
```

### Format Error Response — WAJIB konsisten

**Setiap** error response harus memiliki `error` (string) dan `code` (string konstanta):

```ts
// ✅ Benar — selalu ada code
{ error: "Product not found", code: "PRODUCT_NOT_FOUND" }
{ error: "Internal server error", code: "INTERNAL_ERROR" }
{ error: "Forbidden: ADMIN role required", code: "FORBIDDEN" }
{ error: "Insufficient stock: ...", code: "INSUFFICIENT_STOCK" }
{ error: "Invalid product identifier", code: "INVALID_IDENTIFIER" }

// ❌ Salah — tanpa code
{ error: "Product not found" }
{ error: "Internal server error" }
```

### Kode Error Standar

| Code | Status | Penggunaan |
|------|--------|------------|
| `PRODUCT_NOT_FOUND` | 404 | Product tidak ada atau soft-deleted |
| `INTERNAL_ERROR` | 500 | DB error, unexpected failure |
| `FORBIDDEN` | 403 | Role tidak punya permission |
| `INSUFFICIENT_STOCK` | 409 | Stock kurang untuk reserve |
| `INVALID_PRICE` | 422 | Price ≤ 0 |
| `INVALID_QUANTITY` | 422 | Quantity < 1 (dari schema validation) |
| `INVALID_IDENTIFIER` | 400 | UUID/slug format invalid |
| `VALIDATION_ERROR` | 422 | Body/query/params gagal TypeBox validation |
| `UNAUTHORIZED` | 401 | Service token missing/invalid |

---

## 4. Validation & Type Safety

### Satu Library Validasi — TypeBox via Elysia `t`

Seluruh request/response schema **wajib** pakai Elysia TypeBox (`t` dari `elysia`). Jangan import Zod atau Valibot untuk validasi HTTP — Elysia sudah handle validation + Swagger generation otomatis.

```ts
// ✅ Benar — TypeBox di schemas.ts
import { t } from "elysia";

export const CreateProductBodySchema = t.Object({
  name: t.String({ minLength: 1 }),
  price: t.Number({ minimum: 0 }),
  stock: t.Integer({ minimum: 0 }),
});

// ❌ Salah — Zod untuk HTTP validation
import { z } from "zod";
const schema = z.object({ name: z.string() }); // JANGAN di handler layer
```

> **Exception**: Zod/Valibot boleh dipakai di dalam `@repo/common` untuk shared schemas antar service (misal domain model validation), tapi tidak di handler layer.

### Jangan Duplikasi Validasi Schema

Jika field sudah divalidasi di Elysia route schema (`minimum: 1`, `format: uuid`), **jangan** validasi ulang secara manual di handler:

```ts
// ✅ Benar — schema sudah ada minimum: 1, cukup percaya Elysia
export const StockOperationBodySchema = t.Object({
  quantity: t.Integer({ minimum: 1 }),
});

export const reserveStockHandler = async ({ body, set }) => {
  const { quantity } = body as { quantity: number }; // aman, sudah divalidasi
  // Tidak perlu: if (!Number.isInteger(quantity) || quantity < 1) { ... }
};

// ❌ Salah — duplikasi validasi yang sudah ada di schema
if (!Number.isInteger(quantity) || quantity < 1) { // JANGAN
  set.status = 422;
  return { error: "..." };
}
```

### Konstanta Regex — Satu Tempat, Jangan Duplikasi

```ts
// ✅ Benar — define sekali di tempat yang tepat
// src/handlers/get-one.ts (butuh slug validation sebelum DB)
const UUID_REGEX = /^[0-9a-f]{8}-...-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ❌ Salah — copy-paste ke file lain yang tidak membutuhkannya
// src/handlers/reserve-stock.ts — SLUG_REGEX didefinisi tapi tidak dipakai
```

### TypeScript Strict Compliance

- **Wajib**: semua `as any` harus dihapus atau diganti dengan `instanceof` / type guard
- **Wajib**: tidak ada implicit `any` — TypeScript strict mode aktif
- **Diperbolehkan**: `as { quantity: number }` untuk body dari Elysia Context (limitation framework), tapi harus ada route schema yang memvalidasinya

---

## 5. Logging

### Format Wajib — JSON Structured Logging

Semua log **wajib** menggunakan `JSON.stringify({...})` ke `console.info/warn/error`:

```ts
// ✅ Benar — structured JSON log
console.info(JSON.stringify({
  event: "product_created",
  productId: result.value.id,
  userId,
  requestId,   // ← selalu sertakan requestId untuk correlation
}));

// ❌ Salah — unstructured string
console.log(`Product ${id} created by ${userId}`);
```

### Level Guidelines

| Level | Kapan | Contoh |
|-------|-------|--------|
| `console.info` | Aksi sukses, request masuk | `product_created`, `request_in` |
| `console.warn` | Non-fatal issue | `validation_error`, `cache_miss` |
| `console.error` | Error yang perlu investigasi | `audit_log_write_failed`, `unhandled_error` |

### Fields Wajib di Setiap Log

```ts
{
  event: string,     // snake_case, describes apa yang terjadi
  requestId: string | null,  // dari x-request-id header — selalu sertakan
  // + field relevan lainnya (productId, userId, dll)
}
```

### PII Sanitization

- **Jangan** log `body` mentah — bisa mengandung PII (email, nama, harga)
- Log hanya field identifier: `productId`, `userId`, `requestId`
- Untuk update, log `fields: Object.keys(data)` — bukan value-nya

---

## 6. Drizzle & Database

### Import Operators — Satu Source

Selalu import Drizzle operators dari `drizzle-orm`, bukan re-export dari `@repo/database`:

```ts
// ✅ Benar — langsung dari drizzle-orm
import { eq, sql, and, desc, gte } from "drizzle-orm";
import { db, schema } from "@repo/database";

// ❌ Salah — operator dari re-export (tidak konsisten)
import { db, eq, schema, sql } from "@repo/database";
```

### Soft Delete — Wajib

Semua delete product **wajib** soft-delete via `deleted_at`:

```ts
// ✅ Benar — soft delete
await db.update(schema.products)
  .set({ deletedAt: new Date() })
  .where(sql`${schema.products.id} = ${id} AND ${schema.products.deletedAt} IS NULL`)
  .returning();

// ❌ Salah — hard delete
await db.delete(schema.products).where(eq(schema.products.id, id));
```

Semua query yang membaca data product **wajib** filter `deletedAt IS NULL`.

### Gunakan RETURNING untuk Deteksi No-op

```ts
// ✅ Benar — RETURNING mendeteksi apakah row ditemukan
const result = await db.update(schema.products)
  .set(data)
  .where(eq(schema.products.id, id))
  .returning();
if (!result[0]) return yield* Effect.fail(new ProductNotFoundError({ id }));

// ❌ Salah — SELECT dulu, UPDATE kemudian (TOCTOU race condition)
const existing = await db.select()...;
if (!existing[0]) throw new Error("Not found");
await db.update()...;
```

### Pagination

- Default page size: **20**, maksimum: **100** (enforced di `buildProductQuery`)
- Audit log page size: **50** — konsisten dengan `PAGE_SIZE` konstanta di handler
- Gunakan cursor-based pagination untuk deep pagination — lihat `buildProductQuery` untuk pattern

---

## 7. Tooling & Scripts

### Scripts Wajib di `package.json`

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src/",
    "format:check": "prettier --check \"**/*.{ts,tsx}\" --cache",
    "format:write": "prettier --write \"**/*.{ts,tsx}\" --cache",
    "clean": "rm -rf dist"
  }
}
```

### Environment Variables

Semua env var **wajib** divalidasi via `@repo/env` sebelum dipakai. Jangan akses `process.env` langsung di handler atau repository:

```ts
// ✅ Benar — validated env dari @repo/env
import { env } from "@repo/env/product";
const origin = env.WEB_URL;

// ❌ Salah — unvalidated direct access
const origin = process.env.WEB_URL; // bisa undefined, gagal silent
```

Nama env var: `SCREAMING_SNAKE_CASE` — `INTERNAL_SERVICE_TOKEN`, `PUBLIC_API_URL`.

---

## 8. Checklist Sebelum PR

- [ ] Semua DB access melalui `productRepository.*` (tidak ada `db.*` di handler)
- [ ] Setiap error response punya field `error` dan `code`
- [ ] Error mapping pakai `instanceof` — tidak ada `as any` untuk error inspection
- [ ] Semua schema di `schemas.ts` (TypeBox `t`) — tidak ada Zod/Valibot di handler layer
- [ ] `requestId` disertakan di setiap structured log
- [ ] Drizzle operators diimport dari `drizzle-orm`, bukan `@repo/database`
- [ ] Soft-delete: setiap delete product set `deletedAt`, setiap read filter `deletedAt IS NULL`
- [ ] `tsc --noEmit` lulus tanpa error
- [ ] `vitest run` lulus

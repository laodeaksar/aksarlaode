# API Gateway — Consistency Todo List

Hasil analisis menyeluruh `apps/api-gateway`. Diurutkan P0 → P3.
Format: `[status]` = `[ ]` belum, `[x]` selesai.

---

## P0 — Breaking Bug / Security Hole

- [x] **C-01** `middleware/cors.ts` — Tambah `"Idempotency-Key"` ke `allowHeaders`
  - **Masalah**: Browser POST dengan header `Idempotency-Key` gagal CORS preflight
  - **Dampak**: Fitur idempotency tidak bisa dipakai dari frontend sama sekali
  - **Fix**: `allowHeaders: [..., "Idempotency-Key"]`

- [x] **C-02** `lib/route-permissions.ts` — Tambah `GET /products/:id/stock` ke `PUBLIC_ROUTES`
  - **Masalah**: Route file mendokumentasikan endpoint ini sebagai "Public read" tapi tidak ada di bypass list — semua caller kena 401
  - **Dampak**: Order-service tidak bisa cek stock saat membuat order baru
  - **Fix**: `{ path: "/products/:id/stock", method: "GET" }` ke `PUBLIC_ROUTES`

- [x] **C-03** `middleware/owner-or-admin.ts` — Wrap fetch dengan circuit breaker + pass `abortSignal`
  - **Masalah**: Satu-satunya code path yang bypass circuit breaker dan tidak punya timeout
  - **Dampak**: Jika order-service down: infinite hang meski gateway timeout sudah fire (resource leak), cascade failure tidak ter-handle
  - **Fix**: Gunakan `getBreaker("ORDER")`, pass `c.var.abortSignal` ke fetch

---

## P1 — Reliability & Security Gap

- [x] **C-04** `index.ts` — Ganti string `!==` dengan `crypto.timingSafeEqual` untuk token comparison
  - **Masalah**: String inequality di JS tidak constant-time
  - **Dampak**: Timing side-channel: attacker bisa brute-force `INTERNAL_SERVICE_TOKEN` character-by-character
  - **Fix**: `Buffer.from` + `crypto.timingSafeEqual`

- [x] **C-05** Multiple files — Extract `getClientIp(c)` ke `lib/client-ip.ts`, hapus 5 duplikat
  - **Masalah**: IP extraction duplikat 5x dengan 3 implementasi berbeda; `logger.ts` tidak pakai `.split(",")[0]?.trim()` → IP yang berbeda di-log vs yang di-rate-limit
  - **Dampak**: Rate limit bisa di-bypass dengan X-Forwarded-For multi-value; log IP tidak akurat
  - **Files**: `logger.ts`, `rate-limiter.ts`, `audit-log.ts`, `idempotency.ts`, `proxy.ts`

- [x] **C-06** `index.ts` — Ubah health degraded dari HTTP `207` → `200`
  - **Masalah**: `207` adalah "Multi-Status" (WebDAV), bukan standar untuk health endpoint
  - **Dampak**: Load balancer dan monitoring probe yang cek HTTP status code tidak mendeteksi degraded — semua interpret sebagai healthy
  - **Fix**: Selalu return `200`, caller cek field `status: "degraded" | "ok"` di body

---

## P2 — Developer Experience & Maintainability

- [x] **C-07** `lib/effect-runner.ts` — Hapus file (dead code)
  - **Masalah**: File ini tidak diimport oleh module manapun; berisi `as any` cast yang unsafe
  - **Fix**: `git rm apps/api-gateway/src/lib/effect-runner.ts`

- [x] **C-08** `routes/product.routes.ts` — Pilih satu dari `PUT /:id` / `PATCH /:id`, dokumentasikan contract-nya
  - **Masalah**: Kedua `PUT` dan `PATCH` terdaftar untuk update produk tanpa dokumentasi kapan pakai mana
  - **Rekomendasi**: Hapus `PUT /:id`, pertahankan `PATCH /:id` untuk partial update. Jika full-replace diperlukan, dokumentasikan di README

- [x] **C-09** Semua routes — Tambah `/v1` prefix (API versioning)
  - **Masalah**: Tidak ada versioning sama sekali — zero ability to evolve contract tanpa breaking change
  - **Strategi non-breaking**: Mount kedua `/v1` dan `/` selama periode migrasi, deprecate `/` setelah semua client update
  - **Files**: `index.ts` (route mounting), semua `route-permissions.ts` patterns

- [x] **C-10** `routes/*.routes.ts` — Rename file ke plural agar konsisten dengan path
  - **Masalah**: `order.routes.ts` → `/orders`, `product.routes.ts` → `/products` dll. — singular vs plural
  - **Fix**: Rename: `order.routes.ts` → `orders.routes.ts`, `product.routes.ts` → `products.routes.ts`, `payment.routes.ts` → `payments.routes.ts`, `webhook.routes.ts` → `webhooks.routes.ts`

---

## P3 — Nice-to-Have

- [x] **C-11** `middleware/rate-limiter.ts` + `middleware/idempotency.ts` — Migrasi store ke Redis
  - **Masalah**: Kedua store pakai in-memory `Map` — tidak survive restart, tidak bekerja dengan multiple gateway instances
  - **Note**: Komentar di kedua file sudah acknowledge ini. Prioritas naik ke P1 saat deploy multi-instance.

- [x] **C-12** Effect consistency — Either all-in atau opt-out
  - **Masalah**: Effect dipakai di `jwt.ts`, `hmac.ts`, `rate-limiter.ts` tapi tidak di `circuit-breaker.ts`, `proxy.ts`, `owner-or-admin.ts`, `idempotency.ts`
  - **Rekomendasi**: Keluarkan Effect dari `rate-limiter.ts` (overkill untuk sync logic) agar boundary yang menggunakan Effect jelas: hanya untuk I/O async yang perlu typed errors (`jwt.ts`, `hmac.ts`)

- [x] **C-13** `middleware/auth-resolver.ts` — Aktifkan session denylist check
  - **Masalah**: Komentar di baris 76-91 menjelaskan implementasi yang dibutuhkan tapi belum diaktifkan
  - **Dampak**: Logged-out user JWT tetap valid sampai expiry — revokasi session tidak efektif
  - **Note**: Butuh Redis shared antara auth-service dan gateway

- [x] **C-14** Test coverage — Saat ini nol
  - **Masalah**: Tidak ada satu pun test file di seluruh `apps/api-gateway/src/`
  - **Minimal yang dibutuhkan**: Unit test untuk `lib/jwt.ts`, `lib/hmac.ts`, `lib/circuit-breaker.ts`; integration test untuk middleware chain (authResolver, routeGuard, ownerOrAdmin)

- [x] **C-15** `proxy.ts` — Hapus `as unknown as Response` double cast
  - **Masalah**: `return c.json(...) as unknown as Response` — workaround type mismatch antara Hono `Response` dan native `Response`
  - **Fix**: Return tipe `Response | Promise<Response>` dari `proxyTo`, atau wrap dengan `Promise.resolve()`

---

## Standar Response yang Disepakati

```ts
// Error dari gateway layer (bukan passthrough dari upstream)
interface GatewayError {
  error: string          // human-readable
  code: GatewayErrorCode // machine-readable untuk frontend switch
  requestId: string      // untuk support tracing
}

type GatewayErrorCode =
  | "UNAUTHORIZED" | "TOKEN_EXPIRED" | "FORBIDDEN"
  | "INVALID_IDEMPOTENCY_KEY" | "IDEMPOTENCY_CONFLICT"
  | "PAYLOAD_TOO_LARGE" | "RATE_LIMITED"
  | "CIRCUIT_OPEN" | "UPSTREAM_ERROR" | "GATEWAY_TIMEOUT"
  | "INTERNAL_ERROR" | "INVALID_SERVICE_TOKEN"
```

## Skor Konsistensi (per kategori)

| Kategori | Score | Catatan |
|---|---|---|
| API Contract & Routing | 6/10 | No versioning, 207 salah, file naming mismatch |
| Validation & Serialization | 7/10 | Gateway-level validation solid, tapi no output validation |
| Arsitektur & Pattern | 7/10 | Middleware chain bersih, Effect tidak konsisten |
| Security & Middleware | 6/10 | CORS bug, non-constant-time compare, ownerOrAdmin tanpa timeout |
| Integrasi & Upstream | 8/10 | Circuit breaker solid, tapi ownerOrAdmin bypass |
| Code Quality & Monorepo | 5/10 | Nol test, dead code, IP duplikat 5x |

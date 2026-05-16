# Security Fix TODO — Master Checklist
**Terakhir diperbarui:** Mei 2026  
**Referensi:** `docs/security/AUDIT_REPORT.md`  
**Cakupan:** 66 temuan audit + 13 temuan tambahan = **79 item total**

---

## Legenda

| Simbol | Arti |
|--------|------|
| `[x]` | Selesai (sudah ada di kode atau di-patch di wave sebelumnya) |
| `[~]` | Di-patch di sesi review ini (Mei 2026) |
| `[ ]` | Belum dikerjakan |
| `*` | Item ini sudah ada sebelum audit dilakukan |

---

## ✅ Selesai — P0 Critical (Wave 1 & 2)

- [x] **PRD-01** `product-service` — Atomic `reserveStock` (eliminasi TOCTOU race condition)
- [x] **EML-01** `auth-service` — Queue name `"password-reset"` → `"email"`, job name → `"password-reset"`, payload fix `{ userId, email, resetLink }`
- [x] **EML-02** `email-worker` — Buat `lib/user-client.ts` dengan `fetchUserEmail` + `fetchUserName` via auth-service
- [x] **EML-02** `email-worker` — Semua handler (`order-created`, `order-confirmation`, `order-cancelled`, `shipping-update`) gunakan `payload.userEmail`
- [x] **EML-03** `email-worker` — Tambah `userEmail` ke semua `EmailJobPayload` types; producer di order-service + payment-service diperbarui
- [x] **EML-04** `email-worker` — HTML escaping di `templates/engine.ts` via `escapeHtml()` *(bonus P2)*
- [x] **EML-06** `email-worker` — Fix typo nama file `sipping-update.ts` → `shipping-update.ts` *(bonus)*
- [x] **ADM-01** `apps/admin` — Login: baca role dari `data.user.role` (bukan `data.data.role` / `data.role`)
- [x] **WEB-01** `apps/web` — Buat Astro API route `pages/api/payment/initiate.ts`
- [x] **WEB-02** `apps/web` — Hapus dynamic `<script>` injection Midtrans di `PaymentSnap.tsx`
- [x] **GW-04** `api-gateway` — Cache webhook body ke `webhookRawBody` context variable; proxy baca dari cache
- [x] **PAY-02** `payment-service` — Tambah `upsert()` (INSERT ON CONFLICT DO UPDATE) ke `payment.repository.ts`
- [x] **PAY-02** `payment-service` — Tambah `updateByOrderId()` ke `payment.repository.ts`
- [x] **PAY-02** `payment-service` — Buat `lib/email-queue.ts` (Effect-based BullMQ producer)
- [x] **PAY-03** `payment-service` — Fix `initiate.ts`: gunakan `Effect.either(findByOrderId)` agar first-call tidak crash HTTP 500
- [x] **PAY-04** `payment-service` — Pisah menjadi `PAYMENT_STATUS_MAP` + `ORDER_STATUS_MAP`; `deny`/`expire` → `"CANCELLED"`
- [x] *(post-wave)* `order-service` — Propagate `userEmail` ke job `order-created` via `auth-client.ts`

---

## ✅ Selesai — P1 High (Wave 3)

- [x] **AUTH-01** `auth-service` — Rate limit per-email `recordForgotPasswordAttempt` (3 req / 15 mnt via Redis hashed key); response selalu 200 (enumeration-safe) *
- [x] **AUTH-02** `auth-service` — Revoke sesi aktif saat reset: `consumeResetToken` atomik (token + password + session dalam 1 Postgres transaction) *
- [x] **GW-01** `api-gateway` — CORS: origin dibatasi ke allowlist `[WEB_URL, ADMIN_URL]`; tidak ada wildcard *
- [x] **GW-03** `api-gateway` — `bodySizeLimiter` middleware per-path: auth/payment 64 KB, orders 512 KB, products 10 MB *
- [x] **EML-05** `email-worker` — DLQ alerting: structured log `ALERT_EMAIL_DEAD_LETTER` + severity `CRITICAL` + optional webhook ke `ALERT_WEBHOOK_URL` *
- [x] **ORD-02** `order-service` — Trigger reconciliation manual dilindungi `role === "ADMIN"` + `x-service-token` *
- [x] **PRD-02** `product-service` — Validasi `quantity >= 1` di `reserve-stock.ts` + `release-stock.ts` (HTTP 422 `INVALID_QUANTITY`) *
- [x] **PRD-03** `product-service` — Validasi UUID atau slug `^[a-z0-9]+(?:-[a-z0-9]+)*$` di `get-one.ts` via `isValidInput()` (HTTP 400 `INVALID_IDENTIFIER`) *
- [x] **ADM-02** `apps/admin` — Silent token refresh: interceptor 401 `TOKEN_EXPIRED` → `/auth/refresh` → retry; satu in-flight refresh di-share antar concurrent requests *

---

## ✅ Selesai — P1 High (Wave 4)

- [x] **GW-02** `api-gateway` — Circuit breaker state dipersist ke Redis pada setiap transisi; `restoreAllBreakers()` dipanggil saat startup; fail-open jika Redis down; TTL 24 jam *
- [x] **PAY-01** `payment-service` — `redactAuthFromMessage()` strip `Basic [base64]` dari semua error message sebelum dibuat objek error *
- [x] **WEB-03** `apps/web` — Cookie forwarding konsisten: semua Astro API routes menggunakan `apiFetch` dengan `cookie: request.headers.get("cookie")` *
- [x] **WEB-04** `apps/web` — CSRF: Layer 1 = `SameSite=Strict` cookie; Layer 2 = Origin header validation untuk semua non-GET `/api/*` → HTTP 403 `CSRF_ORIGIN_MISMATCH` *
- [x] **ADM-03** `apps/admin` — Server-side pagination di orders, products, customers (page + limit = 20); state `page`, `status`, `search` per halaman *

---

## 🔧 Di-patch — Sesi Review Mei 2026

- [~] **ORD-01** `order-service` — `VALID_TRANSITIONS` map + `InvalidTransitionError` ditambahkan langsung ke `orderRepository.updateStatus`; setiap caller (termasuk webhook) kini dilindungi di lapisan repository. Webhook menangkap `InvalidTransitionError` dan ACK 200 (bukan 500).
  > *Catatan: handler `update-status.ts` sudah punya state machine sebelumnya — fix ini menutup celah di semua caller lain termasuk payment webhook.*
- [~] **AUTH-03** `auth-service` — Dikonfirmasi tidak memerlukan `crypto.timingSafeEqual`: perbandingan token dilakukan via SQL `WHERE` parameterized di database (bukan `===` di JavaScript). Tidak ada JavaScript timing side-channel.
- [~] **AUTH-05** `auth-service` — Denylist 40 password umum di `lib/password-strength.ts`; dipanggil di `register.ts` dan `reset-password.ts` sebelum Argon2 hash; gagal dengan `ValidationError` 422.
- [~] **PAY-05** `payment-service` — Idempotency guard di `webhook.ts`: fetch status payment saat ini dengan `Effect.either(findByOrderId)` sebelum memproses; jika status sudah sama → skip semua side effects (releaseStock, email jobs) dan ACK `{ received: true }`.
- [~] **AUTH-04** `api-gateway` / `auth-service` — Field `email` ditambahkan ke JWT access token payload di `issueTokenPair`; gateway mengekstrak dari `JwtPayload` dan menginjeksikan `x-user-email` header di `buildUpstreamHeaders()`. Downstream services (order, payment) kini bisa baca email langsung dari header tanpa round-trip ke auth-service.
- [~] **ORD-03** `order-service` — Fungsi `stripHtml()` ditambahkan di `create.ts`; field `notes` dibersihkan dari HTML tags sebelum persist ke repository. Mencegah XSS di admin panel yang merender notes.
- [~] **ORD-05b** `order-service` — Dikonfirmasi sudah ada: `CreateOrderBodySchema` di TypeBox `minItems: 1` pada array `items`. Tidak memerlukan perubahan kode.
- [~] **ORD-06** `order-service` — Dikonfirmasi sudah ada: `shippingAddress` schema memvalidasi semua field wajib (`recipientName`, `phone`, `street`, `city`, `province`, `postalCode`) sebagai `t.String()` non-opsional. Tidak memerlukan perubahan kode.
- [~] **PAY-07** `payment-service` — Field `userEmail` ditambahkan ke tabel `payments` (kolom `user_email` nullable, migration `0002_add_payment_user_email.sql`); `initiateHandler` membaca header `x-user-email` (diinjeksikan AUTH-04) dan menyimpannya via `paymentRepository.upsert`; `webhookHandler` kini membaca `payment.userEmail` langsung tanpa fallback ke auth-service (cast `as any` dihapus).
- [~] **PAY-06** `payment-service` — Amount integrity check di `webhookHandler`: `notification.gross_amount` (string Midtrans) di-parse + round lalu dibandingkan dengan `existingResult.right.amount` (integer DB). Jika beda → log `ALERT_PAYMENT_AMOUNT_MISMATCH` severity CRITICAL + return `{ received: true }` tanpa update order/email jobs. Check hanya dilakukan jika payment record sudah ada (skip jika `Left` — initiate belum jalan).
- [~] **WEB-05** `apps/web` — Fungsi `sanitizeUpstreamError()` ditambahkan di `initiate.ts`; dispatch berdasarkan `_tag` error: `NetworkError` → 503 + "Payment service temporarily unavailable" (bukan `String(fetchError)` yang bisa berisi URL internal), `ParseError` → 502 + "Upstream returned an invalid response", `NotFoundError` → 404 tanpa `resource` path, `HttpError` → forward message gateway (controlled), default → 500. Import `NetworkError` lama dihapus, ganti ke `ApiError` union.
- [~] **WEB-06** `apps/web` — `layers.ts` diperbarui: impor `@repo/env` yang broken (barrel tidak export `env`) diganti dengan `import.meta.env` Astro native. Prioritas URL: `INTERNAL_API_URL` (server-only, tanpa prefix PUBLIC_) → `PUBLIC_API_URL` (fallback dev). Client-side tidak pernah memanggil `apiFetch` langsung — semua browser requests ke path relatif `/api/*` yang diproxy oleh Astro server-side.
- [~] **ADM-04** `apps/admin` — Modal konfirmasi `AlertDialog` dari `@repo/ui/components/alert-dialog` ditambahkan di dua tempat: (1) `products/index.tsx` — `DeleteButton` mengganti `window.confirm()` dengan AlertDialog berlabel "Aksi ini tidak bisa dibatalkan. Produk akan dihapus secara permanen."; (2) `orders/$orderId.tsx` — tombol "Update Status" membuka AlertDialog khusus saat `nextStatus === "CANCELLED"` (transisi ke status lain langsung jalan tanpa konfirmasi).

---

## ✅ Selesai — P1 High (Wave 6)

- [x] **PRD-01b** `product-service` — `update` dan `deleteById` menggunakan RETURNING + WHERE `deletedAt IS NULL` secara langsung; `ProductNotFoundError` diekspos dari repository dan di-map ke HTTP 404 di handler.

---

## 🟡 Belum Selesai — P2 Medium

### auth-service
- [x] **AUTH-06** `auth-service` — `login.ts` mengekstrak `ip` (dari `x-real-ip` → `x-forwarded-for`) dan `userAgent` (dari `user-agent` header); keduanya disertakan di `meta` untuk `LOGIN_FAILED` dan `LOGIN_SUCCESS` via `writeAuditLog`. Output: `{ audit: true, event: "LOGIN_FAILED", actorId: "anonymous", emailMask: "u***@domain.com", ip: "...", userAgent: "...", timestamp: "..." }`. AUTH-06-log (P3) dianggap selesai sekaligus karena `writeAuditLog` sudah mencakup semua event: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGED, PASSWORD_RESET, ACCOUNT_CREATED, OWNER_LOGIN, ROLE_CHANGE.

### api-gateway
- [x] **GW-05** `api-gateway` — `request-id.ts` selalu generate `crypto.randomUUID()`; header `x-request-id` dari client diabaikan sepenuhnya.
- [x] **GW-06** `api-gateway` — `timeoutMs` dipindahkan ke `SERVICE_REGISTRY` sebagai single source of truth; `request-timeout.ts` membaca dari sana.
- [x] **GW-07b** `api-gateway` — `proxy.ts` kini log `{ event, service, path, upstreamStatus, latencyMs, requestId }` untuk setiap upstream 5xx dan network error.

### email-worker
- [x] **EML-07** `email-worker` — `lib/payload-schemas.ts` berisi Zod schema untuk semua 5 job type; processor memvalidasi payload sebelum dispatch ke handler; payload malformed gagal dengan `retryable: false`.
- [x] **EML-08** `email-worker` — Unsubscribe link (`{{ unsubscribeUrl }}`) ditambahkan ke template `order-confirmation` dan `shipping-update`; job handler menyuntikkan URL unsubscribe yang di-encode.

### order-service
- [x] **ORD-04** `order-service` — Idempotency key di `create.ts` kini di-scope ke `userId:POST:/orders:rawKey`.

### product-service
- [x] **PRD-04** `product-service` — Migrasi `005_products_soft_delete.sql`; kolom `deletedAt` ditambahkan ke schema; `deleteById` kini soft-delete; semua query filter `deletedAt IS NULL`.
- [x] **PRD-05** `product-service` — `lib/product-cache.ts` in-process TTL cache (60 detik); `findById`, `findByIdOrSlug`, `update`, `deleteById`, `reserveStock`, dan `releaseStock` semuanya invalidate cache setelah mutasi.
- [x] **PRD-06b** `product-service` — `create.ts` dan `update.ts` handler memvalidasi `price > 0`; return 422 `INVALID_PRICE` sebelum menyentuh repository.
- [x] **PRD-07** `product-service` — Cursor-based pagination diimplementasikan di `query-builder.ts`; `list` repository mengembalikan `nextCursor`; `ProductFiltersSchema` di `@repo/common` menerima field `cursor` opsional.

### payment-service
- [~] **PAY-06** *(di-patch — lihat bagian "Di-patch" di atas)*
- [~] **PAY-07** *(di-patch — lihat bagian "Di-patch" di atas)*
- [x] **PAY-08** `payment-service` — Migrasi `004_payment_audit_log.sql`; tabel `payment_audit_log` immutable (append-only); `upsert` log `payment_initiated`, `updateByOrderId` log `payment_status_changed`; failure audit log tidak membatalkan flow payment.

### apps/web
- [~] **WEB-05** *(di-patch — lihat bagian "Di-patch" di atas)*
- [~] **WEB-06** *(di-patch — lihat bagian "Di-patch" di atas)*
- [x] **WEB-07b** `apps/web` — `CheckoutForm.tsx` sekarang memiliki `paymentStatus` state (`idle | failed | cancelled`); Midtrans `onError` menampilkan retry card "Retry Payment" + "View Order"; `onClose` menampilkan card "Continue Payment"; error order-creation menampilkan alert yang jelas dengan border; tidak ada blank page atau silent failure.
- [x] **WEB-08** `apps/web` — `ProductCard.astro` sudah memiliki `loading="lazy"` + ditambahkan `decoding="async"`; `[slug].astro` main image (LCP) mendapat `fetchpriority="high" decoding="async"` (tanpa lazy), thumbnail mendapat `loading="lazy" decoding="async"` + `alt` yang deskriptif; cart item images di `CheckoutForm.tsx` juga mendapat `loading="lazy" decoding="async"`.

### apps/admin
- [~] **ADM-04** *(di-patch — lihat bagian "Di-patch" di atas)*
- [x] **ADM-05** `apps/admin` — `rbac.ts` dengan `can()` + `hasAnyAdminRole()`; `SessionProvider` + `useSession()` context; role OWNER/ADMIN/FINANCE dengan permission map; products page menyembunyikan Add/Edit/Delete untuk FINANCE; orders page menyembunyikan Update Status untuk FINANCE; migrasi `006_add_finance_role.sql`.
- [x] **ADM-06b** `apps/admin` — Migrasi `007_admin_audit_log.sql`; schema `admin-audit-log.ts`; `lib/admin-audit.ts` fire-and-forget writer; `delete.ts` handler menulis audit entry; `GET /products/audit-logs` endpoint (ADMIN/OWNER only); halaman `/audit-logs` di admin panel; sidebar menampilkan link Audit Log hanya untuk role dengan `audit:read`; `rbac.ts` ditambahkan permission `audit:read` untuk ADMIN dan OWNER.
- [x] **ADM-07** `apps/admin` — `components/error-boundary.tsx` class component dengan error card + "Try again" button; `__root.tsx` membungkus `<Outlet />` dengan `<ErrorBoundary>` sehingga crash di satu halaman tidak memblank seluruh panel.

---

## ⚪ Belum Selesai — P3 Low

- [x] **GW-07** `api-gateway` — `GET /internal/health/breakers` ditambahkan di `index.ts` sebelum middleware chain; dilindungi `x-service-token` (dibandingkan dengan `env.INTERNAL_SERVICE_TOKEN`); mengembalikan `{ status, circuits[], ts }` dengan HTTP 207 jika ada breaker tidak CLOSED.
- [x] **ORD-05** `order-service` — `MAX_EXPORT_ROWS` diturunkan dari 50.000 ke 10.000 di `admin-order-export.ts`; header `X-Export-Max-Rows` diperbarui otomatis. Streaming via ReadableStream + MongoDB cursor tetap dipertahankan untuk efisiensi memori.
- [x] **PRD-06** `api-gateway` — `publicProductsRateLimiter` ditambahkan ke `rate-limiter.ts`; di-apply sebagai middleware khusus di `GET /products` route di gateway; 100 req/mnt per IP, `Retry-After` header di-set pada 429.
- [ ] **PAY-06b** `payment-service` — Kirim alert ke ops channel (Slack webhook / PagerDuty) saat `gross_amount` mismatch terdeteksi.
- [x] **WEB-07** `apps/web` — CSP dan security headers ditambahkan via `applySecurityHeaders()` di `middleware.ts`; di-apply ke semua response (`next()` output); header: `Content-Security-Policy` (default-src, script-src Midtrans, style-src unsafe-inline, img-src https:, connect-src, frame-src, font-src, object-src none, base-uri, form-action), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [x] **ADM-06** `apps/admin` — Komponen berat diekstrak ke `products-page.tsx`, `orders-page.tsx`, `customers-page.tsx`; route files menggunakan `React.lazy(() => import('./...-page'))`; `__root.tsx` menambahkan `<Suspense fallback="Loading…">` di dalam `ErrorBoundary` untuk menangkap semua lazy boundaries.
- [x] **EML-09** `email-worker` — `src/lib/metrics.ts` (zero external dep): in-memory Prometheus counter + serialiser; `email_sent_total`, `email_failed_total`, `email_retry_total` per `job_type` label + `email_worker_up` gauge; `incrementCounter()` dipanggil di `completed`/`failed` hooks di `email.processor.ts`; `GET /metrics` (Prometheus text) + `GET /health` diekspos via `Bun.serve` di port `METRICS_PORT` (default 9100) dari `index.ts`.
- [x] **AUTH-06-log** `auth-service` — Selesai bersama AUTH-06 di atas: `writeAuditLog` sudah mencakup LOGIN_SUCCESS, LOGIN_FAILED (kini +ip/ua), LOGOUT, PASSWORD_CHANGED, PASSWORD_RESET, ACCOUNT_CREATED, OWNER_LOGIN, ROLE_CHANGE. Semua emit ke stdout sebagai JSON dengan `audit: true` untuk agregasi log.
- [x] **EML-07-zod** `email-worker` — Duplikat dari EML-07 yang telah selesai di Wave 6: `lib/payload-schemas.ts` berisi Zod schema untuk semua 5 job type. Ditutup.
- [x] **ALL** — `.github/workflows/security-audit.yml`: menjalankan `pnpm audit --audit-level=high` pada setiap push/PR ke main dan jadwal mingguan (Senin 08:00 UTC); upload artefak laporan saat gagal. `renovate.json` di root: Renovate bot config dengan `vulnerabilityAlerts`, group dev deps, skip `@repo/*` workspace packages, prioritas tinggi untuk paket kritis (bullmq, hono, elysia, zod).

---

## Wave Plan

```
Wave 1 ✅  PRD-01, EML-01, ADM-01, WEB-01, WEB-02, GW-04
Wave 2 ✅  PAY-02, PAY-03, PAY-04, EML-02, EML-03, EML-04*, EML-06*, order-service userEmail
Wave 3 ✅  AUTH-01*, AUTH-02*, GW-01*, GW-03*, EML-05*, ORD-02*, PRD-02*, PRD-03*, ADM-02*
Wave 4 ✅  GW-02*, PAY-01*, WEB-03*, WEB-04, ADM-03*
Review ✅  ORD-01 (repository-level), AUTH-03 (verified safe), AUTH-05, PAY-05
Wave 5 ✅  AUTH-04✓, ORD-03✓, ORD-05b✓(existing), ORD-06✓(existing), PAY-07✓, PAY-06✓, WEB-05✓, WEB-06✓, ADM-04✓ │ Remaining (deferred to Wave 6): PRD-01b, ORD-04
Wave 6 ✅  PRD-01b✓, ORD-04✓, GW-05✓, GW-06✓, GW-07b✓, EML-07✓, EML-08✓, PRD-04✓, PRD-05✓, PRD-06b✓, PRD-07✓, PAY-08✓, ADM-05✓
Wave 7 ✅  ADM-06b✓, ADM-07✓, WEB-07b✓, WEB-08✓
```
*Terverifikasi sudah ada sebelum audit dilakukan — tidak memerlukan perubahan kode.

---

## Statistik (diperbarui sesi terakhir — semua P3 selesai kecuali PAY-06b)

| Prioritas | Total | ✅ Selesai | ⏳ Belum |
|-----------|-------|-----------|---------|
| P0 — Critical | 13 | **13** (100%) | 0 |
| P1 — High | ~20 | **~20** (100%) | 0 |
| P2 — Medium | ~21 | **~21** (100%) | 0 |
| P3 — Low | 10 | **9** (semua kecuali PAY-06b) | **1** |
| **Total** | **79** | **~78** (~99%) | **~1** |

### Satu P3 tersisa (memerlukan integrasi eksternal)

| ID | Deskripsi | Alasan ditunda |
|----|-----------|---------------|
| PAY-06b | Alert Slack/PagerDuty saat `gross_amount` mismatch | Membutuhkan webhook URL eksternal (Slack/PagerDuty) yang dikonfigurasi di infra ops — bukan bloker keamanan kode |

### Semua P3 yang telah selesai (sesi terakhir)

| ID | Implementasi |
|----|-------------|
| GW-07 | `GET /internal/health/breakers` dilindungi `x-service-token` di `api-gateway/index.ts` |
| ORD-05 | `MAX_EXPORT_ROWS` 50.000 → 10.000 di `admin-order-export.ts` |
| PRD-06 | `publicProductsRateLimiter` 100 req/mnt per IP di `api-gateway/rate-limiter.ts` + `product.routes.ts` |
| WEB-07 | `applySecurityHeaders()` di `apps/web/middleware.ts`: CSP + X-Content-Type-Options + X-Frame-Options + Referrer-Policy |
| ADM-06 | `React.lazy` + `Suspense` untuk products/orders/customers routes di admin panel |
| EML-09 | `src/lib/metrics.ts` (zero dep) + `GET /metrics` di port 9100 via `Bun.serve` |
| ALL | `.github/workflows/security-audit.yml` (pnpm audit gate) + `renovate.json` (Renovate bot) |

> Audit keamanan selesai ~99%. Satu-satunya item tersisa (PAY-06b) membutuhkan konfigurasi webhook ops di luar codebase.

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
- [ ] **AUTH-06** `auth-service` — Structured audit log untuk login gagal: `{ event: "auth_login_failed", userId/email, ip, userAgent, timestamp }` *(di audit report dilabeli AUTH-06, bukan AUTH-04)*

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

- [ ] **GW-07** `api-gateway` — Endpoint `GET /internal/health/breakers` yang mengembalikan state setiap circuit breaker; dilindungi `x-service-token`.
- [ ] **ORD-05** `order-service` — Turunkan batas maksimum row CSV export dari 50.000 ke 10.000 (atau implementasi streaming dengan progress indicator).
- [ ] **PRD-06** `product-service` — Rate limit ringan untuk `GET /products` publik (100 req/mnt per IP) untuk mencegah scraping katalog.
- [ ] **PAY-06b** `payment-service` — Kirim alert ke ops channel (Slack webhook / PagerDuty) saat `gross_amount` mismatch terdeteksi.
- [ ] **WEB-07** `apps/web` — Content Security Policy header via Astro middleware: minimal `default-src 'self'`, `script-src 'self' https://app.midtrans.com`.
- [ ] **ADM-06** `apps/admin` — Route-based code splitting via `React.lazy()` + `Suspense` untuk mempercepat initial load admin panel.
- [ ] **EML-09** `email-worker` — Metrik Prometheus untuk `email_sent_total`, `email_failed_total`, `email_retry_total` per job type.
- [ ] **AUTH-06-log** `auth-service` — Structured audit log untuk semua event keamanan (login berhasil, login gagal, password reset, logout paksa).
- [ ] **EML-07-zod** `email-worker` — Zod schema validation untuk setiap payload type *(juga ada di P2 — prioritaskan di P2)*.
- [ ] **ALL** — Dependency audit rutin: setup Renovate bot atau cron `pnpm audit` dengan CI gating agar vulnerability baru terdeteksi otomatis.

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

## Statistik

| Prioritas | Total | ✅ Selesai | 🔧 Di-patch sesi ini | ⏳ Belum |
|-----------|-------|-----------|---------------------|---------|
| P0 — Critical | 13 | **13** | 0 | 0 |
| P1 — High | 18 | **16** | **3** (ORD-01, AUTH-04, ORD-05b/06 confirmed) | **1** |
| P2 — Medium | 38 | **1** (AUTH-03 safe) | **9** (AUTH-05, PAY-05, ORD-03, PAY-06, PAY-07, WEB-05, WEB-06, ADM-04, +1) | **28** |
| P3 — Low | 10 | 0 | 0 | **10** |
| **Total** | **79** | **30** | **12** | **39** |

> P0 dihitung 13 karena sub-item Wave 1 & 2 dipecah (EML-02 punya 4 sub-item, PAY-02 punya 3 sub-item, dll).  
> Versi ringkas: dari **66 temuan audit asli** → 33 selesai · 12 di-patch sesi ini · 24 belum.

# Security Fix TODO List
**Terakhir diperbarui:** Mei 2026  
**Referensi:** `docs/security/AUDIT_REPORT.md`

---

## ✅ Selesai — P0 Critical (Wave 1 & 2)

- [x] **PRD-01** `product-service` — Atomic `reserveStock` (eliminasi TOCTOU race condition)
- [x] **EML-01** `auth-service` — Queue name `"password-reset"` → `"email"`, payload fix
- [x] **EML-01** `auth-service` — `forgot-password.ts` payload `{ userId, email, resetLink }`
- [x] **EML-02** `email-worker` — Buat `lib/user-client.ts` dengan `fetchUserEmail` + `fetchUserName`
- [x] **EML-02** `email-worker` — `order-created.ts` gunakan `payload.userEmail`
- [x] **EML-02** `email-worker` — `order-confirmation.ts` import dari `user-client`, hapus referensi undefined
- [x] **EML-02** `email-worker` — `order-cancelled.ts` gunakan `payload.userEmail`
- [x] **EML-02** `email-worker` — `shipping-update.ts` (typo fix + userEmail)
- [x] **EML-03** `email-worker` — Tambah `userEmail` ke semua `EmailJobPayload` types
- [x] **EML-04** `email-worker` — HTML escaping di `templates/engine.ts` *(bonus P2)*
- [x] **EML-06** `email-worker` — Fix typo nama file `sipping-update.ts` → `shipping-update.ts` *(bonus)*
- [x] **ADM-01** `apps/admin` — Login: baca role dari `data.user.role` bukan `data.data.role`
- [x] **WEB-01** `apps/web` — Buat Astro API route `pages/api/payment/initiate.ts`
- [x] **WEB-02** `apps/web` — Hapus dynamic `<script>` injection Midtrans di `PaymentSnap.tsx`
- [x] **GW-04** `api-gateway` — Cache webhook body di `webhookRawBody` context variable
- [x] **GW-04** `api-gateway` — `proxy.ts` baca dari cache, bukan dari stream yang sudah dikonsumsi
- [x] **PAY-02** `payment-service` — Tambah `upsert()` ke `payment.repository.ts`
- [x] **PAY-02** `payment-service` — Tambah `updateByOrderId()` ke `payment.repository.ts`
- [x] **PAY-02** `payment-service` — Buat `lib/email-queue.ts` (Effect-based BullMQ producer)
- [x] **PAY-03** `payment-service` — Fix `initiate.ts`: gunakan `Effect.either(findByOrderId)` agar first-call tidak 500
- [x] **PAY-04** `payment-service` — Pisah menjadi `PAYMENT_STATUS_MAP` + `ORDER_STATUS_MAP`
- [x] *(post-wave)* `order-service` — Propagate `userEmail` ke job `order-created` via `auth-client.ts`

---

## ✅ Selesai — P1 High (Wave 3)

- [x] **AUTH-01** `auth-service` — Rate limit per-email `recordForgotPasswordAttempt` (3 req / 15 menit) di `forgot-password.ts`; response selalu 200 (enumeration-safe)
- [x] **AUTH-02** `auth-service` — Revoke sesi aktif saat reset: `consumeResetToken` sudah atomik (token + password + session dalam 1 transaksi). *(sudah ada sebelumnya)*
- [x] **GW-01** `api-gateway` — CORS: allowlist `[WEB_URL, ADMIN_URL]`. *(sudah ada sebelumnya)*
- [x] **GW-03** `api-gateway` — `bodySizeLimiter` middleware. *(sudah ada sebelumnya)*
- [x] **EML-05** `email-worker` — DLQ alerting: `"email_permanently_failed"` + `"ALERT_EMAIL_DEAD_LETTER"` log terstruktur + optional webhook (`ALERT_WEBHOOK_URL`)
- [x] **ORD-01** `order-service` — State machine `VALID_TRANSITIONS` di `update-status.ts`; `payment-webhook.ts` sudah punya state machine sendiri
- [x] **ORD-02** `order-service` — Trigger reconciliation manual dilindungi `role === "ADMIN"` dan `x-service-token`. *(sudah ada sebelumnya)*
- [x] **PRD-02** `product-service` — Validasi `quantity >= 1` di `reserve-stock.ts` dan `release-stock.ts` (HTTP 422 `INVALID_QUANTITY`)
- [x] **PRD-03** `product-service` — Validasi UUID atau slug `^[a-z0-9]+(?:-[a-z0-9]+)*$` di `get-one.ts` (HTTP 400 `INVALID_IDENTIFIER`)
- [x] **ADM-02** `apps/admin` — Silent token refresh: interceptor 401 `TOKEN_EXPIRED` → call `/auth/refresh` → retry; satu in-flight refresh di-share antar concurrent requests

---

## ✅ Selesai — P1 High (Wave 4)

- [x] **GW-02** `api-gateway` — Circuit breaker state dipersist ke Redis pada setiap transisi (OPEN/CLOSED); `restoreAllBreakers()` dipanggil saat startup sebelum traffic masuk; fail-open jika Redis tidak tersedia; TTL 24 jam; `lib/redis.ts` baru + ioredis ditambahkan ke api-gateway
- [x] **PAY-01** `payment-service` — `redactAuthFromMessage()` strip `Basic [base64]` dari semua error message sebelum masuk ke objek error; `authHeader()` tidak pernah disimpan ke variabel yang bisa masuk ke log
- [x] **WEB-03** `apps/web` — Audit selesai: satu-satunya Astro API route (`/api/payment/initiate.ts`) sudah forward cookie dengan benar; middleware SSR sudah forward cookie; tidak ada gap. *(sudah ada sebelumnya)*
- [x] **WEB-04** `apps/web` — CSRF protection di Astro middleware: Layer 1 = SameSite=Strict cookie (sudah ada); Layer 2 = Origin header validation untuk semua non-GET `/api/*` route (baru); cross-origin request dengan Origin berbeda → HTTP 403 `CSRF_ORIGIN_MISMATCH`
- [x] **ADM-03** `apps/admin` — Server-side pagination di orders (filter by status) dan customers (search); gunakan `DataTable` component yang sudah ada; `page`, `status`, `search` state; pass params sebagai `URLSearchParams` ke API

---

## 🔴 Belum Selesai — P1 High (sisa)

- [ ] **AUTH-04** `api-gateway` / `auth-service` — Pertimbangkan inject `x-user-email` header dari gateway
- [ ] **PRD-01b** `product-service` — Verifikasi RETURNING row count di semua UPDATE operasi

---

## 🟡 Belum Selesai — P2 Medium (28 item)

- [ ] **AUTH-03** `auth-service` — Constant-time comparison untuk reset token hash
- [ ] **AUTH-05** `auth-service` — Validasi kekuatan password (min 8 karakter, denylist password umum)
- [ ] **GW-05** `api-gateway` — Generate requestId baru di gateway, abaikan header dari client
- [ ] **GW-06** `api-gateway` — Timeout berbeda per service di `SERVICE_REGISTRY`
- [ ] **EML-07** `email-worker` — Zod validation payload di processor sebelum dispatch ke handler
- [ ] **ORD-03** `order-service` — Sanitasi HTML dari field `notes` sebelum persist
- [ ] **ORD-04** `order-service` — Scope idempotency key ke `userId:method:path:rawKey`
- [ ] **PRD-04** `product-service` — Soft-delete (`deletedAt`) untuk produk, bukan hard delete
- [ ] **PRD-05** `product-service` — Cache invalidation saat produk diupdate/dihapus
- [ ] **PAY-05** `payment-service` — Idempotency webhook: skip side effects jika status sudah sama
- [ ] **PAY-06** `payment-service` — Verifikasi `gross_amount` dari Midtrans cocok dengan DB
- [ ] **WEB-05** `apps/web` — Filter error upstream sebelum dikembalikan ke browser
- [ ] **WEB-06** `apps/web` — Pastikan `PUBLIC_API_URL` internal tidak ter-bundle ke client JS
- [ ] **ADM-04** `apps/admin` — Modal konfirmasi sebelum aksi destruktif (delete, cancel)
- [ ] **ADM-05** `apps/admin` — RBAC granular (ADMIN / OWNER / FINANCE) di admin panel
- [ ] **AUTH-04** `auth-service` — Audit log untuk login gagal dan password reset event
- [ ] **GW-07b** `api-gateway` — Logging structured untuk semua upstream error (service, path, status)
- [ ] **ORD-05b** `order-service` — Validasi items array tidak kosong di create order
- [ ] **PRD-06b** `product-service` — Validasi harga produk > 0 saat create/update
- [ ] **PAY-07** `payment-service` — Simpan `userEmail` di payment record saat initiate
- [ ] **WEB-07b** `apps/web` — Penanganan error graceful di checkout flow (retry UI, bukan blank page)
- [ ] **ADM-06b** `apps/admin` — Audit log viewer untuk aksi admin (hapus produk, update status)
- [ ] **EML-08** `email-worker` — Unsubscribe link di semua email transaksional
- [ ] **ORD-06** `order-service` — Validasi `shippingAddress` fields tidak kosong/null
- [ ] **PRD-07** `product-service` — Pagination cursor-based untuk list produk (bukan offset — offset tidak efisien di data besar)
- [ ] **PAY-08** `payment-service` — Logging transaksi ke tabel audit terpisah (tidak mutable)
- [ ] **WEB-08** `apps/web` — Image optimization dan lazy loading untuk listing produk
- [ ] **ADM-07** `apps/admin` — Error boundary di semua halaman untuk mencegah blank page

---

## ⚪ Belum Selesai — P3 Low (10 item)

- [ ] **AUTH-06** `auth-service` — Structured audit log untuk semua event keamanan
- [ ] **GW-07** `api-gateway` — Health endpoint `/internal/health/breakers` untuk circuit breaker state
- [ ] **EML-07** `email-worker` — Zod validation schema untuk setiap payload type
- [ ] **ORD-05** `order-service` — Batasi maksimum row di CSV export (10.000 row)
- [ ] **PRD-06** `product-service` — Rate limit untuk endpoint list produk publik
- [ ] **PAY-06b** `payment-service` — Alert ke ops channel saat amount mismatch dari Midtrans
- [ ] **WEB-07** `apps/web` — Content Security Policy header via Astro middleware
- [ ] **ADM-06** `apps/admin` — Route-based code splitting (`React.lazy` + `Suspense`)
- [ ] **EML-09** `email-worker` — Metrik Prometheus untuk email sent/failed/retry per job type
- [ ] **ALL** — Dependency audit rutin (renovate bot atau `npm audit`) dengan CI gating

---

## Deploy Order yang Direkomendasikan

```
Wave 1 (selesai) ─── PRD-01, EML-01, ADM-01, WEB-01, WEB-02, GW-04
Wave 2 (selesai) ─── PAY-02, PAY-03, PAY-04, EML-02, EML-03, order-service userEmail
Wave 3 (selesai) ─── AUTH-01, AUTH-02*, GW-01*, GW-03*, EML-05, ORD-01, ORD-02*, PRD-02, PRD-03, ADM-02
Wave 4 (selesai) ─── GW-02, PAY-01, WEB-03*, WEB-04, ADM-03
Wave 5 ────────────── AUTH-03, AUTH-05, GW-05, GW-06, EML-07, ORD-03, PRD-04, PAY-05, PAY-06
Wave 6 ────────────── Semua P2 tersisa + P3 + hardening tambahan
```
*Terverifikasi sudah ada sebelumnya, tidak perlu perubahan kode.

---

## Statistik Akhir

| Prioritas | Total | Selesai | Sisa |
|-----------|-------|---------|------|
| P0 Critical | 10 | **10** ✅ | 0 |
| P1 High | 18 | **15** ✅ | **3** |
| P2 Medium | 28 | 2* | **26** |
| P3 Low | 10 | 0 | **10** |
| **Total** | **66** | **27** | **39** |

*EML-04 (HTML escaping) dan EML-06 (typo fix) di-patch sebagai bonus di Wave 2.

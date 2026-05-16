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

## 🔴 Belum Selesai — P1 High (18 item)

- [ ] **AUTH-01** `auth-service` — Rate limit per-email untuk `/auth/forgot-password` (3 req / 15 menit)
- [ ] **AUTH-02** `auth-service` — Revoke semua sesi aktif saat password direset
- [ ] **GW-01** `api-gateway` — CORS: ganti wildcard dengan allowlist `[WEB_URL, ADMIN_URL]`
- [ ] **GW-02** `api-gateway` — Persist circuit breaker state ke Redis (restart tidak reset counter)
- [ ] **GW-03** `api-gateway` — Tambah `bodyLimit` middleware per route
- [ ] **EML-05** `email-worker` — DLQ monitoring: alert/webhook saat job gagal semua retry
- [ ] **ORD-01** `order-service` — Validasi state machine di `payment-webhook.ts` (transisi status ilegal → 422)
- [ ] **ORD-02** `order-service` — Lindungi trigger reconciliation manual dengan `x-service-token`
- [ ] **PRD-02** `product-service` — Validasi `quantity >= 1` saat reserve + DB constraint `CHECK (stock >= 0)`
- [ ] **PRD-03** `product-service` — Validasi format slug `^[a-z0-9-]+$` di handler
- [ ] **PAY-01** `payment-service` — Redact `Authorization` header dari error log Midtrans
- [ ] **WEB-03** `apps/web` — Audit semua Astro API routes: pastikan cookie di-forward konsisten
- [ ] **WEB-04** `apps/web` — CSRF protection untuk form mutasi (SameSite=Strict atau CSRF token)
- [ ] **ADM-02** `apps/admin` — Silent token refresh (interceptor 401 TOKEN_EXPIRED → retry)
- [ ] **ADM-03** `apps/admin` — Server-side pagination di semua list view
- [ ] **AUTH-04** `api-gateway` / `auth-service` — Pertimbangkan inject `x-user-email` header dari gateway
- [ ] **PAY-03** `payment-service` — Idempotency full: return existing record jika sudah PAID/PENDING
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
Wave 1 (deployed) ─── PRD-01, EML-01, ADM-01, WEB-01, WEB-02, GW-04
Wave 2 (deployed) ─── PAY-02, PAY-03, PAY-04, EML-02, EML-03, order-service userEmail
Wave 3 ────────────── AUTH-01, AUTH-02, GW-01, GW-03, EML-05, ORD-01, PRD-02, WEB-04, ADM-02, ADM-03
Wave 4 ────────────── AUTH-03, AUTH-05, GW-02, GW-05, GW-06, EML-07, ORD-03/04, PRD-04, PAY-05, PAY-06
Wave 5 ────────────── Semua P3 + hardening tambahan
```

---

## Statistik Akhir

| Prioritas | Total | Selesai | Sisa |
|-----------|-------|---------|------|
| P0 Critical | 10 | **10** ✅ | 0 |
| P1 High | 18 | 0 | **18** |
| P2 Medium | 28 | 2* | **26** |
| P3 Low | 10 | 0 | **10** |
| **Total** | **66** | **12** | **54** |

*EML-04 (HTML escaping) dan EML-06 (typo fix) di-patch sebagai bonus di Wave 2.

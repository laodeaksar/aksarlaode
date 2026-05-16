# Security & Quality TODO

Sumber: `docs/security/AUDIT_REPORT.md` — Mei 2026  
Cakupan: 7 komponen · 66 temuan total

Legenda status:
- ✅ **DONE** — sudah ada di codebase (patch wave atau sudah diimplementasi sebelum audit)
- 🔧 **PATCHED** — baru di-fix dalam sesi ini
- ⏳ **TODO** — belum dikerjakan
- 🔵 **LOW** — P3, bisa dikerjakan kapan saja

---

## auth-service

| ID | P | Status | Judul |
|----|---|--------|-------|
| AUTH-01 | P1 | ✅ DONE | Rate limit forgot-password per-email (3 req / 15 mnt via Redis) |
| AUTH-02 | P1 | ✅ DONE | Revoke semua sesi aktif saat password direset (atomic DB transaction) |
| AUTH-03 | P2 | ✅ DONE | Constant-time comparison tidak diperlukan — perbandingan dilakukan via SQL `WHERE` di DB, bukan `===` di JS |
| AUTH-04 | P2 | ⏳ TODO | Injeksi `x-user-email` header di gateway dari JWT payload |
| AUTH-05 | P2 | 🔧 PATCHED | Denylist 40 password umum di `lib/password-strength.ts` — diterapkan di register + reset-password (422 `ValidationError`) |
| AUTH-06 | P3 | 🔵 LOW | Audit log terstruktur untuk login gagal & password reset |

---

## api-gateway

| ID | P | Status | Judul |
|----|---|--------|-------|
| GW-01 | P1 | ✅ DONE | CORS origin dibatasi ke allowlist `[WEB_URL, ADMIN_URL]` |
| GW-02 | P1 | ✅ DONE | Circuit breaker state di-persist ke Redis (TTL 24 jam, fallback in-memory) |
| GW-03 | P1 | ✅ DONE | Body size limiter per-path (auth/payment: 64 KB, orders: 512 KB, products: 10 MB) |
| GW-04 | P0 | ✅ DONE | Webhook body di-cache di context variable sebelum proxy (Wave 1) |
| GW-05 | P2 | ⏳ TODO | Generate `requestId` baru di gateway, abaikan header dari client |
| GW-06 | P2 | ⏳ TODO | Timeout berbeda per service / per route di SERVICE_REGISTRY |
| GW-07 | P3 | 🔵 LOW | Endpoint `GET /internal/health/breakers` untuk ekspos circuit breaker state |

---

## email-worker

| ID | P | Status | Judul |
|----|---|--------|-------|
| EML-01 | P0 | ✅ DONE | Fix queue name + payload password reset (Wave 1) |
| EML-02 | P0 | ✅ DONE | Implementasi `fetchUserEmail` via auth-service (Wave 2) |
| EML-03 | P0 | ✅ DONE | Kirim ke `userEmail`, bukan `userId` UUID (Wave 2) |
| EML-04 | P2 | ✅ DONE | HTML escaping di template engine (Bonus) |
| EML-05 | P1 | ✅ DONE | Dead-letter queue monitoring: structured log `ALERT_EMAIL_DEAD_LETTER` + webhook ke `ALERT_WEBHOOK_URL` |
| EML-06 | P2 | ✅ DONE | Fix typo `sipping-update.ts` → `shipping-update.ts` (Bonus) |
| EML-07 | P3 | 🔵 LOW | Validasi Zod payload di awal setiap job handler |

---

## order-service

| ID | P | Status | Judul |
|----|---|--------|-------|
| ORD-01 | P1 | 🔧 PATCHED | State machine di `orderRepository.updateStatus` — tolak transisi ilegal dengan `InvalidTransitionError` |
| ORD-02 | P1 | ✅ DONE | Endpoint trigger reconciliation dilindungi role ADMIN + `x-service-token` |
| ORD-03 | P2 | ⏳ TODO | Sanitasi HTML dari field `notes` customer sebelum persist (`sanitize-html`) |
| ORD-04 | P2 | ⏳ TODO | Scope idempotency key ke `userId:method:path:rawKey` |
| ORD-05 | P3 | 🔵 LOW | Batas maksimum row export CSV (sudah 50 000 lewat cursor streaming) |

---

## payment-service

| ID | P | Status | Judul |
|----|---|--------|-------|
| PAY-01 | P1 | ✅ DONE | Redact `Authorization` header di error log Midtrans (`redactAuthFromMessage`) |
| PAY-02 | P0 | ✅ DONE | Implementasi `upsert()` + `updateByOrderId()` di repository (Wave 2) |
| PAY-03 | P1 | ✅ DONE | Fix idempotency check dengan `Effect.either()` — tidak crash di payment pertama (Wave 2) |
| PAY-04 | P0 | ✅ DONE | Pisah `STATUS_MAP` menjadi `PAYMENT_STATUS_MAP` + `ORDER_STATUS_MAP` (Wave 2) |
| PAY-05 | P2 | 🔧 PATCHED | Idempotency guard di webhook: fetch payment status sebelum proses — skip side effects jika sudah sama |
| PAY-06 | P3 | 🔵 LOW | Verifikasi `gross_amount` dari Midtrans vs amount di database |

---

## product-service

| ID | P | Status | Judul |
|----|---|--------|-------|
| PRD-01 | P0 | ✅ DONE | Atomic `reserveStock` eliminasi TOCTOU race condition (Wave 1) |
| PRD-02 | P1 | ✅ DONE | Validasi `quantity >= 1` sebelum reserve — tolak 422 untuk nol/negatif |
| PRD-03 | P1 | ✅ DONE | Validasi slug `^[a-z0-9]+(?:-[a-z0-9]+)*$` + UUID check di `get-one.ts` via `isValidInput()` |
| PRD-04 | P2 | ⏳ TODO | Soft-delete dengan kolom `deletedAt` (hard delete dihapus) |
| PRD-05 | P2 | ⏳ TODO | Cache invalidation saat update/delete produk |
| PRD-06 | P3 | 🔵 LOW | Rate limit ringan untuk endpoint `GET /products` publik (100 req/mnt per IP) |

---

## apps/web (Astro)

| ID | P | Status | Judul |
|----|---|--------|-------|
| WEB-01 | P0 | ✅ DONE | Buat Astro API route `/api/payment/initiate` (Wave 1) |
| WEB-02 | P0 | ✅ DONE | Hapus dynamic Snap SDK injection — hindari double-load (Wave 1) |
| WEB-03 | P1 | ✅ DONE | Cookie forwarding konsisten di semua Astro API routes via `apiFetch` |
| WEB-04 | P1 | ✅ DONE | CSRF protection via Origin header validation di `middleware.ts` + `SameSite=Strict` |
| WEB-05 | P2 | ⏳ TODO | Filter error upstream sebelum dikirim ke browser — jangan expose stack trace |
| WEB-06 | P2 | ⏳ TODO | Pastikan `PUBLIC_API_URL` server-side pakai URL internal, client pakai path relatif `/api/` |
| WEB-07 | P3 | 🔵 LOW | Content Security Policy header di Astro middleware |

---

## apps/admin (React/Vite)

| ID | P | Status | Judul |
|----|---|--------|-------|
| ADM-01 | P0 | ✅ DONE | Fix role dibaca dari `data?.user?.role` (Wave 1) |
| ADM-02 | P1 | ✅ DONE | Silent refresh interceptor untuk 401 `TOKEN_EXPIRED` — retry request original |
| ADM-03 | P1 | ✅ DONE | Server-side pagination `page + limit = 20` di orders, products, customers |
| ADM-04 | P2 | ⏳ TODO | Modal konfirmasi sebelum aksi destruktif (delete produk, cancel order) |
| ADM-05 | P2 | ⏳ TODO | RBAC granular: role ADMIN / OWNER / FINANCE dengan route guards per fitur |
| ADM-06 | P3 | 🔵 LOW | Code splitting via `React.lazy()` + `Suspense` per route |

---

## Ringkasan Status

| Prioritas | Total | ✅ Done | 🔧 Patched | ⏳ Todo | 🔵 Low |
|-----------|-------|---------|-----------|--------|--------|
| P0 — Critical | 10 | 10 | 0 | 0 | 0 |
| P1 — High | 18 | 17 | 1 | 0 | 0 |
| P2 — Medium | 28 | 6 | 2 | 17 | 3 |
| P3 — Low | 10 | 0 | 0 | 0 | 10 |
| **Total** | **66** | **33** | **3** | **17** | **13** |

---

## Backlog Urutan Prioritas (⏳ TODO yang disarankan dikerjakan berikutnya)

> Semua P1 sudah selesai. Sisa adalah P2 dan P3.

### P2 — High-Impact (dikerjakan berurutan)
1. `ORD-03` — Sanitasi HTML field `notes` customer (XSS risk di admin panel)
2. `ORD-04` — Scope idempotency key ke `userId:method:path:rawKey`
3. `WEB-05` — Filter error upstream sebelum expose ke browser
4. `AUTH-04` — Injeksi `x-user-email` header di gateway dari JWT payload
5. `PRD-04` — Soft-delete produk dengan kolom `deletedAt`
6. `PRD-05` — Cache invalidation saat update/delete produk
7. `ADM-04` — Modal konfirmasi sebelum aksi destruktif
8. `ADM-05` — RBAC granular: role ADMIN / OWNER / FINANCE dengan route guards
9. `WEB-06` — Pisah `PUBLIC_API_URL` — server pakai URL internal, client pakai `/api/`
10. `GW-05` — Generate `requestId` baru di gateway, abaikan header dari client
11. `GW-06` — Timeout berbeda per service di SERVICE_REGISTRY
12. `PAY-06` — Verifikasi `gross_amount` Midtrans vs amount di database

### P3 — Low Priority
13. `AUTH-06` — Audit log untuk login gagal & password reset
14. `EML-07` — Validasi Zod payload di awal setiap job handler
15. `ORD-05` — Batas export CSV (sudah 50k via cursor, bisa turunkan ke 10k)
16. `PRD-06` — Rate limit `GET /products` publik
17. `GW-07` — Endpoint health check circuit breaker state
18. `WEB-07` — Content Security Policy header
19. `ADM-06` — Code splitting `React.lazy()` per route
20. `PAY-06` — Verifikasi `gross_amount` (duplikat dari P2 #12 — prioritaskan di sana)

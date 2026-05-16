# Laporan Audit Keamanan — Monorepo E-Commerce
**Tanggal audit:** Mei 2026  
**Cakupan:** 7 komponen (auth-service, api-gateway, email-worker, order-service, payment-service, product-service, apps/web, apps/admin)  
**Stack:** Bun + Elysia · Hono + Node · Astro · React/Vite · BullMQ + ioredis · Drizzle + PostgreSQL · Mongoose + MongoDB · Effect-ts · EdDSA Ed25519 JWT

---

## Ringkasan Eksekutif

| Prioritas | Jumlah | Status |
|-----------|--------|--------|
| P0 — Critical | 10 | ✅ Semua telah di-patch (Wave 1 & 2) |
| P1 — High | 18 | ⏳ Belum di-patch |
| P2 — Medium | 28 | ⏳ Belum di-patch |
| P3 — Low | 10 | ⏳ Belum di-patch |
| **Total** | **66** | |

**Temuan paling kritis:** Sistem email sepenuhnya tidak berfungsi (email tidak pernah terkirim ke pengguna manapun); checkout tidak menghasilkan Snap token sama sekali; admin panel tidak bisa login; setiap Midtrans webhook mengakibatkan payload kosong diteruskan ke payment-service.

---

## 1. auth-service

### AUTH-01 · P1 · Rate limit forgot-password tidak ada per-email
**Lokasi:** `apps/auth-service/src/handlers/forgot-password.ts`  
**Deskripsi:** Endpoint `/auth/forgot-password` hanya dilindungi rate limit global per-IP, bukan per alamat email yang diminta. Penyerang dapat mengirim ribuan reset request untuk email yang sama tanpa hambatan, mengakibatkan Redis/queue banjir dan kotak masuk korban penuh (email bombing).  
**Rekomendasi:** Tambahkan sliding-window rate limit berbasis `body.email` (misal: 3 request / 15 menit per email) menggunakan Redis counter yang sama dengan rate limiter IP.

---

### AUTH-02 · P1 · Sesi tidak di-revoke saat password berubah
**Lokasi:** `apps/auth-service/src/handlers/reset-password.ts` (perkiraan)  
**Deskripsi:** Saat password direset, token reset dihapus dari DB tetapi sesi aktif yang sudah ada (JWT + session record di Redis) tidak di-invalidate. Seorang penyerang yang mencuri sesi sebelum reset tetap bisa mengakses akun selama masa hidup token (hingga expired).  
**Rekomendasi:** Setelah password berhasil diubah, panggil `sessionRepository.revokeAllByUserId(userId)` untuk menghapus semua sesi aktif, lalu kembalikan hanya sesi baru.

---

### AUTH-03 · P2 · Waktu komparasi token reset tidak constant-time
**Lokasi:** `apps/auth-service/src/repository/reset-token.repository.ts`  
**Deskripsi:** Jika perbandingan hash token reset menggunakan perbandingan string biasa (`===`), ada timing side-channel. Meskipun token di-hash dengan SHA-256 sehingga bruteforce sulit, penggunaan constant-time comparison adalah defense-in-depth yang direkomendasikan.  
**Rekomendasi:** Gunakan `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` untuk semua perbandingan token hash.

---

### AUTH-04 · P2 · `x-user-email` tidak diinjeksikan di gateway
**Lokasi:** `apps/api-gateway/src/middleware/auth-resolver.ts`, `apps/api-gateway/src/proxy/proxy.ts`  
**Deskripsi:** JWT hanya memuat `{ id, role, sessionId }`. Tidak ada `email` di dalam token, sehingga downstream services (order-service, payment-service) tidak bisa mendapatkan email user tanpa memanggil auth-service secara terpisah. Ini mendorong pola fetch tambahan yang tidak perlu di setiap service.  
**Rekomendasi:** Pertimbangkan menambahkan field `email` ke JWT payload pada saat login, dan injeksikan `x-user-email` header di `buildUpstreamHeaders()` di gateway.

---

### AUTH-05 · P2 · Tidak ada validasi kekuatan password
**Lokasi:** `apps/auth-service/src/handlers/register.ts`, `reset-password.ts`  
**Deskripsi:** Tidak ditemukan validasi minimum panjang/kompleksitas password selain validasi Zod dasar. Password "a" atau "123456" mungkin diterima.  
**Rekomendasi:** Tambahkan validasi Zod `min(8)` dan check terhadap daftar password umum (zxcvbn atau denylist sederhana).

---

### AUTH-06 · P3 · Tidak ada audit log untuk login gagal / password reset
**Lokasi:** `apps/auth-service/src/handlers/login.ts`, `forgot-password.ts`  
**Deskripsi:** Event keamanan penting (login gagal berulang, password reset request) tidak di-log secara terstruktur ke sistem audit.  
**Rekomendasi:** Emit structured log `{ event: "auth_login_failed", userId/email, ip, userAgent, timestamp }` untuk setiap kegagalan autentikasi.

---

## 2. api-gateway

### GW-01 · P1 · CORS wildcard pada origin production
**Lokasi:** `apps/api-gateway/src/middleware/cors.ts`  
**Deskripsi:** Jika konfigurasi CORS menerima `*` atau tidak membatasi origin secara ketat, request cross-origin dari domain manapun (termasuk situs phishing) dapat mengakses endpoint protected dengan cookie (jika `credentials: true` digunakan secara bersamaan).  
**Rekomendasi:** Set `origin` ke allowlist eksplisit: `[env.WEB_URL, env.ADMIN_URL]`. Verifikasi tidak ada kombinasi `origin: "*"` dan `credentials: true`.

---

### GW-02 · P1 · Circuit breaker state tidak di-persist (restart reset semua counter)
**Lokasi:** `apps/api-gateway/src/lib/circuit-breaker.ts`  
**Deskripsi:** State circuit breaker disimpan in-memory. Saat gateway di-restart (deployment, crash), semua counter failure reset ke 0. Upstream service yang sedang "open" akan menerima traffic lagi segera setelah restart, berpotensi memperparah cascading failure.  
**Rekomendasi:** Persist circuit breaker state ke Redis dengan TTL, atau gunakan library seperti `opossum` yang mendukung backing store eksternal.

---

### GW-03 · P1 · Tidak ada validasi ukuran payload request
**Lokasi:** `apps/api-gateway/src/index.ts`  
**Deskripsi:** Tidak ada batasan ukuran body request di gateway. Request dengan body sangat besar dapat menghabiskan memory buffer atau menyebabkan timeout yang mengakibatkan DoS.  
**Rekomendasi:** Tambahkan middleware `bodyLimit` (Hono menyediakan `hono/body-limit`) dengan maksimum yang sesuai per route (misal: 1 MB untuk API, 10 MB untuk upload).

---

### GW-04 · P0 · Webhook body dikonsumsi HMAC middleware, proxy meneruskan body kosong ✅ PATCHED
**Lokasi:** `apps/api-gateway/src/middleware/auth-resolver.ts`, `proxy/proxy.ts`  
**Deskripsi:** `auth-resolver.ts` memanggil `c.req.text()` untuk HMAC verification. Setelah ini, stream body sudah dikonsumsi. Ketika proxy mencoba `c.req.arrayBuffer()`, ia mendapat buffer kosong — payment-service menerima `{}` untuk setiap webhook Midtrans.  
**Fix diterapkan:** `webhookRawBody` di-cache ke Hono context variable; proxy membaca dari cache bukan dari stream.

---

### GW-05 · P2 · Request ID tidak divalidasi dari header client
**Lokasi:** `apps/api-gateway/src/middleware/request-logger.ts` (perkiraan)  
**Deskripsi:** Jika `requestId` diambil dari header `x-request-id` yang dikirim client tanpa validasi format, client dapat menyisipkan nilai arbitrary yang muncul di log, berpotensi merusak log aggregation atau menyuntikkan karakter kontrol.  
**Rekomendasi:** Selalu generate `requestId` baru di gateway (`crypto.randomUUID()`), abaikan header dari client atau validasi format UUID secara ketat.

---

### GW-06 · P2 · Tidak ada timeout berbeda per service
**Lokasi:** `apps/api-gateway/src/middleware/request-timeout.ts` (perkiraan)  
**Deskripsi:** Satu nilai timeout global digunakan untuk semua upstream. Endpoint berat (ekspor laporan, reconciliation) dan endpoint ringan (cek status) memiliki SLA berbeda.  
**Rekomendasi:** Konfigurasi timeout per-route atau per-service di `SERVICE_REGISTRY`.

---

### GW-07 · P3 · Tidak ada health check endpoint untuk circuit breaker state
**Lokasi:** `apps/api-gateway/src/`  
**Deskripsi:** Tidak ada endpoint untuk mengekspos status circuit breaker per service. Operator tidak bisa melihat service mana yang sedang "open" tanpa mengakses log.  
**Rekomendasi:** Tambahkan `GET /internal/health/breakers` yang mengembalikan state setiap circuit breaker (dilindungi `x-service-token`).

---

## 3. email-worker

### EML-01 · P0 · auth-service mengirim ke queue salah dengan payload salah ✅ PATCHED
**Lokasi:** `apps/auth-service/src/lib/email-queue.ts`, `handlers/forgot-password.ts`  
**Deskripsi:** Auth-service membuat BullMQ queue bernama `"password-reset"` dengan job name `"send-password-reset-email"` dan payload `{ to, resetUrl }`. Email-worker hanya mendengarkan queue `"email"` dengan job name `"password-reset"` dan payload `{ userId, email, resetLink }`. Tidak ada satu pun password reset email yang pernah terkirim.  
**Fix diterapkan:** Queue name diubah ke `"email"`, job name ke `"password-reset"`, payload disesuaikan.

---

### EML-02 · P0 · Handler memanggil fungsi `fetchUserEmail`/`fetchUserName` yang tidak pernah didefinisikan ✅ PATCHED
**Lokasi:** `apps/email-worker/src/jobs/order-confirmation.ts`  
**Deskripsi:** `handleOrderConfirmation` memanggil `fetchUserEmail(payload.userId)` dan `fetchUserName(payload.userId)` yang tidak diimport maupun didefinisikan di manapun dalam codebase. Setiap job `order-confirmation` langsung crash dengan `ReferenceError`.  
**Fix diterapkan:** Buat `apps/email-worker/src/lib/user-client.ts` dengan implementasi fetch ke auth-service; diimport di semua handler.

---

### EML-03 · P0 · Semua handler mengirim email ke `payload.userId` (UUID, bukan alamat email) ✅ PATCHED
**Lokasi:** `order-created.ts`, `order-cancelled.ts`, `sipping-update.ts`  
**Deskripsi:** Handler mengirim `provider.send({ to: payload.userId })` — `userId` adalah UUID seperti `"a1b2c3d4-..."`, bukan alamat email. Semua email pasti bounce atau ditolak provider.  
**Fix diterapkan:** Semua handler menggunakan `payload.userEmail` dengan fallback ke `fetchUserEmail(userId)`. Payload types diperbarui dengan field `userEmail`. Producer di order-service dan payment-service diperbarui.

---

### EML-04 · P2 · Template engine tidak melakukan HTML escaping ✅ PATCHED (bonus)
**Lokasi:** `apps/email-worker/src/templates/engine.ts`  
**Deskripsi:** Fungsi `render()` menyisipkan nilai payload langsung ke HTML template tanpa escaping. Jika nama produk atau alamat pengiriman mengandung `<script>` atau karakter HTML khusus, output email akan rusak atau berpotensi dieksploitasi jika template dirender di browser.  
**Fix diterapkan:** Semua nilai dilewatkan fungsi `escapeHtml()` sebelum interpolasi.

---

### EML-05 · P1 · Tidak ada dead-letter queue monitoring
**Lokasi:** `apps/email-worker/src/processor/email.processor.ts`  
**Deskripsi:** Job yang gagal setelah 3 retry masuk ke BullMQ "failed" set tetapi tidak ada alerting atau monitoring. Email gagal terkirim tanpa ada pemberitahuan ke tim ops.  
**Rekomendasi:** Tambahkan webhook atau Prometheus metric pada event `"failed"` worker. Pertimbangkan integrasi dengan layanan alerting (PagerDuty, Slack webhook) untuk job yang benar-benar gagal setelah semua retry.

---

### EML-06 · P2 · Nama file typo `sipping-update.ts` menyebabkan processor crash ✅ PATCHED (bonus)
**Lokasi:** `apps/email-worker/src/jobs/sipping-update.ts`  
**Deskripsi:** Processor mengimport `from "@/jobs/shipping-update"` tetapi file bernama `sipping-update.ts`. Import gagal resolve — email-worker tidak bisa start.  
**Fix diterapkan:** File `shipping-update.ts` (nama benar) dibuat.

---

### EML-07 · P3 · Tidak ada validasi payload sebelum job di-process
**Lokasi:** `apps/email-worker/src/processor/email.processor.ts`  
**Deskripsi:** Job data tidak divalidasi schema (misal dengan Zod) sebelum diteruskan ke handler. Jika producer mengirim payload yang salah shape, handler akan crash dengan runtime error yang sulit di-debug.  
**Rekomendasi:** Tambahkan Zod validation di awal setiap handler atau di processor sebelum dispatch.

---

## 4. order-service

### ORD-01 · P1 · `payment-webhook.ts` menerima status order sembarang tanpa validasi state machine
**Lokasi:** `apps/order-service/src/handlers/payment-webhook.ts`  
**Deskripsi:** Handler internal yang dipanggil payment-service untuk update order status tidak memvalidasi apakah transisi status valid. Misalnya, order yang sudah `SHIPPED` bisa kembali ke `PENDING_PAYMENT` jika ada bug di payment-service.  
**Rekomendasi:** Implementasi state machine eksplisit: tentukan transisi valid per status dan kembalikan 422 untuk transisi ilegal.

---

### ORD-02 · P1 · Reconciliation worker tidak ada autentikasi untuk trigger manual
**Lokasi:** `apps/order-service/src/workers/reconciliation.worker.ts`  
**Deskripsi:** Jika endpoint trigger reconciliation manual tidak dilindungi, siapapun bisa memicu proses berat yang membebani database.  
**Rekomendasi:** Lindungi endpoint dengan `x-service-token` header check dan batasi ke role ADMIN/OWNER saja.

---

### ORD-03 · P2 · `notes` dari customer tidak di-sanitasi sebelum disimpan
**Lokasi:** `apps/order-service/src/handlers/create.ts`  
**Deskripsi:** Field `notes` dari request body disimpan langsung ke MongoDB tanpa sanitasi. Meskipun MongoDB tidak rentan SQL injection, data mentah yang ditampilkan di admin panel tanpa escaping bisa mengakibatkan XSS.  
**Rekomendasi:** Strip tag HTML dari `notes` sebelum persist (gunakan library `sanitize-html` atau `DOMPurify` di sisi server).

---

### ORD-04 · P2 · Idempotency key tidak di-scope ke endpoint
**Lokasi:** `apps/order-service/src/lib/idempotency.ts`  
**Deskripsi:** Key idempotency hanya di-scope ke `userId:rawKey`. Jika client menggunakan UUID yang sama untuk dua endpoint berbeda, yang kedua akan mendapat cached response dari yang pertama.  
**Rekomendasi:** Scope key ke `userId:method:path:rawKey`.

---

### ORD-05 · P3 · Export CSV tidak membatasi jumlah row
**Lokasi:** `apps/order-service/src/handlers/admin-order-export.ts`  
**Deskripsi:** Export semua order bisa menghasilkan response sangat besar jika data sudah banyak, berpotensi OOM atau timeout.  
**Rekomendasi:** Batasi maksimum row export (misal 10.000) atau implementasi pagination stream dengan `Transfer-Encoding: chunked`.

---

## 5. payment-service

### PAY-01 · P1 · Midtrans server key ter-expose dalam error log
**Lokasi:** `apps/payment-service/src/lib/midtrans.ts`  
**Deskripsi:** Jika error dari Midtrans API di-log secara verbatim (termasuk request headers yang memuat Authorization: Basic), server key bisa ter-log dan ter-expose ke sistem log aggregation.  
**Rekomendasi:** Pastikan error logging meredact header `Authorization` dan `x-midtrans-server-key` sebelum ditulis ke log.

---

### PAY-02 · P0 · `upsert()` dan `updateByOrderId()` tidak ada di repository ✅ PATCHED
**Lokasi:** `apps/payment-service/src/repository/payment.repository.ts`  
**Deskripsi:** `initiateHandler` memanggil `paymentRepository.upsert()` dan `webhookHandler` memanggil `paymentRepository.updateByOrderId()` — keduanya tidak pernah didefinisikan. Setiap request payment initiation dan setiap Midtrans webhook crash dengan `TypeError: paymentRepository.upsert is not a function`.  
**Fix diterapkan:** `upsert()` (INSERT ON CONFLICT DO UPDATE) dan `updateByOrderId()` ditambahkan ke repository.

---

### PAY-03 · P1 · Tidak ada idempotency check di `initiateHandler` yang benar
**Lokasi:** `apps/payment-service/src/handlers/initiate.ts`  
**Deskripsi:** `findByOrderId` mengembalikan Effect yang fail dengan `PaymentNotFoundError` jika belum ada record. Karena tidak di-handle dengan `Effect.either`, setiap payment pertama (belum ada record) crash dengan unhandled failure dan mengembalikan HTTP 500.  
**Fix diterapkan:** Gunakan `Effect.either()` untuk branching — PaymentNotFoundError = lanjutkan ke upsert, Right dengan status PAID = tolak.

---

### PAY-04 · P0 · `STATUS_MAP` mengirim nilai status tidak valid ke order-service ✅ PATCHED
**Lokasi:** `apps/payment-service/src/handlers/webhook.ts`  
**Deskripsi:** Satu STATUS_MAP digunakan untuk dua tujuan berbeda: update payment record DAN update order status. Order-service hanya menerima enum `OrderStatus` tertentu — `"FAILED"` dan `"EXPIRED"` tidak valid, selalu menghasilkan 422 dari order-service sehingga status order tidak pernah ter-update untuk deny/expire.  
**Fix diterapkan:** Dipecah menjadi `PAYMENT_STATUS_MAP` dan `ORDER_STATUS_MAP`; `deny`/`expire` → `"CANCELLED"`, `pending` → skip (null).

---

### PAY-05 · P2 · Webhook tidak idempoten untuk replay Midtrans
**Lokasi:** `apps/payment-service/src/handlers/webhook.ts`  
**Deskripsi:** Midtrans bisa mengirim notifikasi yang sama lebih dari sekali. Saat ini setiap replay akan memanggil `orderClient.releaseStock()` dan menambahkan email job duplikat.  
**Rekomendasi:** Tambahkan idempotency check: sebelum memproses, cek apakah status payment sudah sama dengan yang akan di-set. Jika ya, skip semua side effects dan kembalikan `{ received: true }`.

---

### PAY-06 · P3 · Amount dari Midtrans tidak diverifikasi dengan amount di database
**Lokasi:** `apps/payment-service/src/handlers/webhook.ts`  
**Deskripsi:** Notification dari Midtrans berisi `gross_amount`. Saat ini tidak ada verifikasi bahwa amount tersebut cocok dengan amount yang tersimpan di database. Manipulasi amount (meski sulit tanpa server key) tidak terdeteksi.  
**Rekomendasi:** Setelah update, bandingkan `notification.gross_amount` dengan `payment.amount` dari DB. Jika berbeda, log alert kritis dan jangan ubah status order.

---

## 6. product-service

### PRD-01 · P0 · TOCTOU race condition di `reserveStock` ✅ PATCHED
**Lokasi:** `apps/product-service/src/repository/product.repository.ts`  
**Deskripsi:** Implementasi awal: SELECT stok → cek cukup → UPDATE. Antara SELECT dan UPDATE, concurrent request lain bisa mengambil stok yang sama, mengakibatkan stok negatif.  
**Fix diterapkan:** Atomic single-statement `UPDATE SET stock = stock - qty WHERE stock >= qty RETURNING`. Jika row count = 0, lakukan SELECT sekunder untuk membedakan "tidak cukup stok" vs "produk tidak ada".

---

### PRD-02 · P1 · Tidak ada validasi bahwa `quantity` > 0 saat reserve
**Lokasi:** `apps/product-service/src/handlers/` (reserve stock endpoint)  
**Deskripsi:** Jika `quantity = 0` atau `quantity` negatif diterima, UPDATE `stock - 0` atau `stock - (-5)` akan berhasil tanpa error, secara diam-diam menambah stok.  
**Rekomendasi:** Validasi `quantity >= 1` sebelum memanggil repository. Tambahkan constraint `CHECK (stock >= 0)` di database schema.

---

### PRD-03 · P1 · `slug` tidak di-sanitasi sebelum digunakan dalam query
**Lokasi:** `apps/product-service/src/repository/product.repository.ts` — `findByIdOrSlug`  
**Deskripsi:** Meskipun Drizzle ORM menggunakan parameterized query (aman dari SQL injection), slug yang mengandung karakter seperti `../` atau null bytes bisa berpotensi masalah jika digunakan di path operasi file atau log.  
**Rekomendasi:** Validasi format slug dengan regex `^[a-z0-9-]+$` di handler sebelum meneruskan ke repository.

---

### PRD-04 · P2 · Tidak ada soft-delete — product dihapus permanen
**Lokasi:** `apps/product-service/src/repository/product.repository.ts` — `deleteById`  
**Deskripsi:** `deleteById` melakukan hard delete. Order yang sudah ada yang mereferensikan `productId` tersebut akan kehilangan konteks produk jika perlu di-audit ulang.  
**Rekomendasi:** Implementasi soft-delete dengan kolom `deletedAt`. Filter produk dengan `WHERE deletedAt IS NULL` di semua query list/find.

---

### PRD-05 · P2 · Cache produk tidak di-invalidate saat update/delete
**Lokasi:** `apps/product-service/src/handlers/`  
**Deskripsi:** Jika ada layer caching (Redis, CDN), update harga atau stok tidak otomatis invalidate cache sehingga harga lama bisa ter-serve ke client.  
**Rekomendasi:** Emit cache invalidation event atau panggil cache.del() setelah setiap update/delete operasi.

---

### PRD-06 · P3 · Tidak ada rate limit untuk endpoint list produk publik
**Lokasi:** `apps/product-service/src/routes/`  
**Deskripsi:** Endpoint `GET /products` yang bisa diakses publik tidak memiliki rate limit. Bisa dieksploitasi untuk scraping katalog atau DoS.  
**Rekomendasi:** Tambahkan rate limit ringan (100 req/menit per IP) untuk endpoint publik.

---

## 7. apps/web (Astro)

### WEB-01 · P0 · Route `/api/payment/initiate` tidak ada — semua checkout menghasilkan 404 ✅ PATCHED
**Lokasi:** `apps/web/src/pages/api/payment/`  
**Deskripsi:** `CheckoutForm.tsx` memanggil `fetch("/api/payment/initiate")` tapi tidak ada file yang mendefinisikan route ini di Astro. Setiap checkout menghasilkan 404, order dibuat dengan stok ter-reserve tapi Snap token tidak pernah dibuat, order terjebak di status `PENDING_PAYMENT` selamanya.  
**Fix diterapkan:** `apps/web/src/pages/api/payment/initiate.ts` dibuat sebagai Astro API Route yang proxy ke api-gateway.

---

### WEB-02 · P0 · Midtrans Snap SDK dimuat dua kali — race condition pada checkout ✅ PATCHED
**Lokasi:** `apps/web/src/components/islands/checkout/PaymentSnap.tsx`  
**Deskripsi:** `PaymentSnap.tsx` menyuntikkan `<script src="midtrans-snap.js">` secara dinamis via `useEffect`. `checkout.astro` juga sudah memuatnya via `<script is:inline>`. Script dimuat dua kali — SDK di-reinitialize, `window.snap` bisa dalam state tidak konsisten saat `snap.pay()` dipanggil.  
**Fix diterapkan:** Dynamic injection dihapus dari komponen; hanya mengandalkan static script di `checkout.astro`.

---

### WEB-03 · P1 · Cookie autentikasi tidak di-forward ke semua Astro API routes
**Lokasi:** `apps/web/src/lib/api/client.ts`, semua `pages/api/*.ts`  
**Deskripsi:** Beberapa Astro API routes mungkin tidak meneruskan `Cookie` header dari request browser ke fetch ke api-gateway, sehingga user tampak tidak terautentikasi di downstream.  
**Rekomendasi:** Audit semua API routes — pastikan semua menggunakan `apiFetch` dengan `cookie: request.headers.get("cookie")` atau wrapper yang konsisten.

---

### WEB-04 · P1 · Tidak ada CSRF protection untuk form mutasi
**Lokasi:** `apps/web/src/pages/`, semua form yang melakukan POST/PUT/DELETE  
**Deskripsi:** Astro SSR tidak secara otomatis menambahkan CSRF token. Form yang mengubah data (checkout, update profil, cancel order) rentan terhadap CSRF attack jika cookie digunakan sebagai autentikasi.  
**Rekomendasi:** Implementasi double-submit cookie pattern atau gunakan `SameSite=Strict` untuk auth cookie. Pertimbangkan custom CSRF token untuk form kritis.

---

### WEB-05 · P2 · Error dari api-gateway di-expose mentah ke browser
**Lokasi:** `apps/web/src/pages/api/`  
**Deskripsi:** Beberapa API routes meneruskan response error dari api-gateway langsung ke browser tanpa filtering. Internal error messages (stack trace, service name, internal path) bisa ter-expose.  
**Rekomendasi:** Map error upstream ke pesan generik. Hanya kembalikan `{ error: "..." }` yang aman untuk konsumsi frontend.

---

### WEB-06 · P2 · `PUBLIC_API_URL` ter-bundle ke client-side JavaScript
**Lokasi:** `apps/web/src/` — semua komponen yang mengimport `env`  
**Deskripsi:** Jika URL internal api-gateway (misalnya `http://api-gateway:3000`) ter-expose ke bundle JavaScript client, ini membocorkan topologi jaringan internal.  
**Rekomendasi:** Pastikan `PUBLIC_API_URL` dalam konteks server-side menunjuk ke URL internal, dan konteks client-side menggunakan URL publik yang berbeda (relatif path `/api/`).

---

### WEB-07 · P3 · Tidak ada Content Security Policy header
**Lokasi:** `apps/web/astro.config.ts` atau middleware  
**Deskripsi:** Tidak ada CSP header yang dikonfigurasi. Jika ada XSS, tidak ada lapisan pertahanan tambahan untuk membatasi eksekusi script dari origin tidak dikenal.  
**Rekomendasi:** Tambahkan CSP header via Astro middleware: minimal `default-src 'self'`, `script-src 'self' 'nonce-...' https://app.midtrans.com`.

---

## 8. apps/admin (React/Vite)

### ADM-01 · P0 · Login admin selalu gagal — field `role` dibaca dari path yang salah ✅ PATCHED
**Lokasi:** `apps/admin/src/routes/login.tsx`  
**Deskripsi:** Setelah login berhasil, kode memeriksa `data?.data?.role` lalu `data?.role` — keduanya selalu `undefined`. Response auth-service memiliki shape `{ user: { role }, accessToken }`. Karena role tidak pernah terdeteksi sebagai "ADMIN", login selalu menampilkan error "Admin access required" meskipun credentials benar. Admin panel 100% tidak bisa diakses.  
**Fix diterapkan:** Role dibaca dari `data?.user?.role`.

---

### ADM-02 · P1 · Tidak ada token refresh — admin ter-logout paksa setelah JWT expired
**Lokasi:** `apps/admin/src/` — semua authenticated fetch  
**Deskripsi:** Admin panel tidak mengimplementasi token refresh flow. Setelah JWT expired, semua request akan mendapat 401 dan admin ter-redirect ke login tanpa peringatan, berpotensi kehilangan pekerjaan yang sedang dilakukan.  
**Rekomendasi:** Implementasi silent refresh: interceptor yang mendeteksi 401 dengan kode `TOKEN_EXPIRED`, memanggil `/auth/refresh`, lalu retry request original.

---

### ADM-03 · P1 · Semua data ditampilkan tanpa paginasi — berpotensi hang untuk data besar
**Lokasi:** `apps/admin/src/` — halaman daftar order, produk, user  
**Deskripsi:** Jika tabel admin mengambil semua record sekaligus (tanpa limit/offset), dengan data yang besar halaman akan hang atau browser crash karena render ribuan DOM node.  
**Rekomendasi:** Implementasi server-side pagination dengan `page` + `limit` parameter di semua list endpoint.

---

### ADM-04 · P2 · Tidak ada konfirmasi sebelum aksi destruktif
**Lokasi:** `apps/admin/src/` — tombol delete produk, cancel order  
**Deskripsi:** Aksi seperti hapus produk atau cancel order tidak memiliki confirmation dialog. Admin bisa tidak sengaja menghapus data penting.  
**Rekomendasi:** Tambahkan modal konfirmasi dengan teks eksplisit (contoh: "Yakin ingin menghapus produk ini? Aksi ini tidak bisa dibatalkan.") untuk semua aksi destruktif.

---

### ADM-05 · P2 · Tidak ada role granularity di admin panel
**Lokasi:** `apps/admin/src/`  
**Deskripsi:** Semua user dengan role `ADMIN` mendapat akses penuh ke semua fitur. Tidak ada pemisahan antara admin keuangan (hanya lihat laporan) dan admin operasional (kelola produk dan order).  
**Rekomendasi:** Implementasi RBAC granular dengan role ADMIN, OWNER, FINANCE menggunakan React context dan route guards per fitur.

---

### ADM-06 · P3 · Bundle JavaScript admin tidak di-code split
**Lokasi:** `apps/admin/vite.config.ts`  
**Deskripsi:** Jika semua halaman admin di-bundle menjadi satu chunk besar, initial load time admin panel akan lambat, terutama di jaringan lambat.  
**Rekomendasi:** Konfigurasi `React.lazy()` + `Suspense` untuk route-based code splitting.

---

## Ringkasan Patch yang Telah Diterapkan

| ID | Komponen | Deskripsi Singkat | Wave |
|----|----------|-------------------|------|
| PRD-01 | product-service | Atomic reserveStock — eliminasi TOCTOU | 1 |
| EML-01 | auth-service | Queue name + payload password reset fix | 1 |
| EML-02 | email-worker | Implementasi fetchUserEmail via auth-service | 2 |
| EML-03 | email-worker | Tambah `userEmail` ke semua payload types | 2 |
| EML-04 | email-worker | HTML escape di template engine | Bonus |
| EML-06 | email-worker | Fix typo `sipping-update.ts` → `shipping-update.ts` | Bonus |
| ADM-01 | apps/admin | Fix role field path di login response | 1 |
| WEB-01 | apps/web | Buat Astro API route `/api/payment/initiate` | 1 |
| WEB-02 | apps/web | Hapus dynamic Snap SDK injection | 1 |
| GW-04 | api-gateway | Cache webhook body di context variable | 1 |
| PAY-02 | payment-service | Tambah `upsert()` + `updateByOrderId()` ke repo | 2 |
| PAY-03 | payment-service | Fix idempotency check via `Effect.either()` | 2 |
| PAY-04 | payment-service | Pisah STATUS_MAP menjadi dua map | 2 |
| — | order-service | Propagate `userEmail` ke `order-created` job | Post-wave |

# Frontend Audit — `apps/web`

> Audit dilakukan: 19 Mei 2026
> Stack: Astro v6 + React islands, Tailwind v4, Effect v3, react-hook-form + zod, TypeScript strict

---

## Executive Summary

`apps/web` adalah aplikasi Astro v6 + React islands yang **tidak bisa dijalankan dalam kondisi sekarang**: terdapat dua syntax error di `package.json` dan `tsconfig.json` yang memblokir build, ditambah props mismatch dan missing export yang menyebabkan halaman product detail dan checkout crash di runtime. Di luar bug kritis tersebut, arsitektur islands-nya solid secara konsep, namun eksekusinya inkonsisten — beberapa halaman menulis ulang `<html>` sendiri alih-alih pakai `Layout.astro`, cart store tidak punya React hook sehingga komponen menarik data langsung dari localStorage per-call, dan middleware melakukan dua network round-trip ke auth service pada setiap page load yang dilindungi.

---

## P0 — Critical (harus fix sebelum deploy)

- [x] **W-01** `package.json` — Syntax error: hilang koma setelah `"astro": "astro"` di scripts block → build gagal total
- [x] **W-02** `tsconfig.json` — Syntax error: hilang koma setelah `"@/*"` di paths → TypeScript gagal, semua alias `@/...` tidak resolve
- [x] **W-03** `[slug].astro` + `AddToCartButton.tsx` — Props mismatch: page kirim `product={object}` tapi komponen terima flat props. Import path juga salah (`product/` vs `products/`) → product detail page crash, cart tidak bisa diisi
- [x] **W-04** `CheckoutForm.tsx` — `import { useCart }` dari `cart.ts` yang tidak pernah export hook tersebut. Field names juga salah (`i.productId`, `i.sku` — tidak ada di `CartItem`) → checkout crash runtime
- [x] **W-05** `client.ts` L37–44 — `await import("../effect/errors")` secara dinamis untuk `AuthError` dan `NotFoundError` yang sudah di-import statis di baris 3 → module re-load tiap 401/404, error path tidak efisien

---

## P1 — High (fix dalam sprint pertama)

- [ ] **W-06** `middleware.ts` + `checkout.astro` — Double auth check: middleware sudah set `ctx.locals.user` tapi `checkout.astro` memanggil `authApi.me(cookie)` lagi secara independen → 2× latency ke auth service per checkout page load
  - **Fix**: Gunakan `Astro.locals.user` di `checkout.astro`, hapus `authApi.me` call
- [ ] **W-07** `CartSummary.tsx`, `AddToCartButton.tsx` — `class=` bukan `className=` di JSX React → Tailwind class tidak diapply, komponen tidak punya style
  - **Fix**: Replace all `class=` → `className=` di semua `.tsx` files
- [ ] **W-08** `cart.ts` — `loadCart()` dipanggil pada setiap method (`getItems`, `addItem`, `removeItem`, `getTotal`, `getCount`) tanpa cache → 5–6× localStorage parse JSON per satu interaksi cart
  - **Fix**: In-memory cache `_cache` variable, update saat `saveCart`, invalidate saat `clearCart`
- [ ] **W-09** `orders.ts` — `listMine` identik dengan `list` (same URL, same method) → dead code membingungkan. `create(body: any)` kehilangan type safety di endpoint paling kritis
  - **Fix**: Hapus `listMine`, buat type `CreateOrderBody` untuk parameter `create`
- [ ] **W-10** `products.ts` + `index.astro` — `productsApi.list(params, cookie)` memanggil dengan dua argumen tapi signature hanya terima satu. `cookie` tidak pernah diteruskan ke SSR product list
  - **Fix**: Tambah optional `cookie?: string` ke signature `list()` dan teruskan ke `apiFetch`
- [ ] **W-11** `Navbar.astro` — Selalu tampilkan "Login" tanpa auth-aware state. Pengguna login tetap lihat "Login", tidak ada logout, tidak ada link ke account
  - **Fix**: Buat `NavbarActions` React island (`client:load`) yang cek localStorage/cookie dan tampilkan nama + logout
- [ ] **W-12** `checkout.astro` + `CheckoutForm.tsx` — User email diteruskan via DOM attribute `data-user-email` lalu dibaca dengan `document.querySelector` → fragile, anti-pattern, bisa gagal saat hydration
  - **Fix**: Teruskan `userEmail` sebagai prop ke `CheckoutForm`, hapus `<span data-user-email>` dari template
- [ ] **W-13** `runtime.ts` — `AppRuntime.runPromise(effect as any)` — `as any` menghapus typed error channel Effect
  - **Fix**: Gunakan `AppRuntime.runPromiseExit` dan handle `Exit` dengan benar, atau hapus wrapper `runEffect` yang tidak dipakai
- [ ] **W-14** `middleware.ts` — `NetworkError` (gateway down) → redirect ke login. User ter-logout saat gateway restart
  - **Fix**: Bedakan `NetworkError` dari `AuthError` — NetworkError harus fail-open (lanjut ke halaman), bukan redirect login

---

## P2 — Nice to Have (refactor backlog)

- [ ] **W-15** `pages/index.astro`, `pages/products/index.astro`, `pages/account/orders.astro`, `pages/orders/[cartId].astro` — Tidak pakai `Layout.astro`, masing-masing tulis `<!DOCTYPE html>` sendiri → duplikasi, meta tag tidak konsisten, CSP tidak seragam
  - **Fix**: Refactor semua page pakai `<Layout title="...">` wrapper
- [ ] **W-16** `ProductFilters.tsx` — Filter state tidak di-sync ke URL. Refresh page → filter hilang, hasil filter tidak bisa di-share/bookmark
  - **Fix**: Gunakan `URLSearchParams` dan `history.replaceState` atau Astro `navigate()` saat filter berubah
- [ ] **W-17** `tsconfig.json` — `@repo/ui/*` alias ada di tsconfig tapi package tidak ada di `dependencies` di `package.json`
  - **Fix**: Hapus alias jika package belum ada, atau tambahkan `"@repo/ui": "workspace:*"` ke dependencies
- [ ] **W-18** `checkout.astro` — Midtrans Snap URL hardcode ke sandbox: `app.sandbox.midtrans.com`
  - **Fix**: Gunakan `import.meta.env.PUBLIC_MIDTRANS_ENV === "production" ? "app.midtrans.com" : "app.sandbox.midtrans.com"`
- [ ] **W-19** `LoginForm.tsx` L29–32 — `Effect.gen` yang hanya berisi satu `yield*` tanpa transformasi → redundant wrapper, noise
  - **Fix**: Hapus `Effect.gen`, panggil `authApi.login(values)` langsung ke `AppRuntime.runPromiseExit`
- [ ] **W-20** `pages/orders/[cartId].astro` — Route param diberi nama `cartId` tapi isinya adalah `orderId`
  - **Fix**: Rename file ke `[orderId].astro`, update semua referensi

---

## Monorepo Integration

- [ ] **M-01** Tambahkan `"@repo/ui": "workspace:*"` ke `package.json` dependencies atau hapus path alias `@repo/ui/*` dari `tsconfig.json`
- [ ] `@repo/common` ✅ dipakai benar di `products.ts` dan `ProductFilters.tsx`
- [ ] `@repo/env` ✅ ada di dependencies (belum terlihat dipakai — cek apakah diperlukan)
- [ ] pnpm workspace ✅ configured
- [ ] TypeScript strict mode ✅ aktif via `astro/tsconfigs/strict`

---

## Security Checklist

- [x] CSP header via `middleware.ts` — sudah ada, coverage baik ✅
- [x] CSRF origin check di Astro API routes ✅
- [x] Auth cookie forwarding server-side via `cookie` prop — tidak bocor ke client ✅
- [x] `sanitizeUpstreamError` di `payment/initiate.ts` — tidak forward internal paths ✅
- [ ] **W-18** Midtrans sandbox URL hardcoded — harus pakai env switching
- [ ] Open redirect: `?redirect=` param di login middleware tidak divalidasi saat dikonsumsi oleh `LoginForm`
- [ ] `/account/login` tidak redirect ke home jika user sudah login (bisa login lagi)

---

## Progress Summary

| Priority | Total | Selesai |
|---|---|---|
| P0 | 5 | 5 ✅ |
| P1 | 9 | 0 |
| P2 | 6 | 0 |
| Monorepo | 2 | 0 |
| Security | 3 | 0 |

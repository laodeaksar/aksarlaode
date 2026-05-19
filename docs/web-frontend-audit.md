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

- [x] **W-06** `middleware.ts` + `checkout.astro` — Double auth check: middleware sudah set `ctx.locals.user` tapi `checkout.astro` memanggil `authApi.me(cookie)` lagi secara independen → 2× latency ke auth service per checkout page load
  - **Fix**: `checkout.astro` sekarang gunakan `Astro.locals.user`, hapus redundant `authApi.me` call + import `authApi`. Ditambah `src/env.d.ts` dengan `App.Locals` type.
- [x] **W-07** `CartSummary.tsx`, `CartDrawer.tsx` — `class=` bukan `className=` di JSX React → Tailwind class tidak diapply, komponen tidak punya style
  - **Fix**: Rewrite kedua file dengan `className=` di seluruh JSX. Bonus: keduanya sekarang pakai `useCart()` hook alih-alih `addEventListener` manual.
- [x] **W-08** `cart.ts` — `loadCart()` dipanggil pada setiap method tanpa cache → 5–6× localStorage parse JSON per satu interaksi cart
  - **Fix**: In-memory `_cache` variable — `loadCart()` parse sekali, `saveCart()` update cache sekaligus. (Diselesaikan bersama W-04.)
- [x] **W-09** `orders.ts` — `listMine` identik dengan `list` → dead code. `create(body: any)` → tidak ada type safety
  - **Fix**: Hapus `listMine`. Tambah `CreateOrderBody` type yang fully typed untuk semua field order creation.
- [x] **W-10** `products.ts` + `index.astro` + `products/index.astro` — `productsApi.list(params, cookie)` dengan dua argumen tapi signature hanya terima satu
  - **Fix**: Hapus argumen `cookie` yang berlebih di `index.astro` dan `products/index.astro` — product list adalah public endpoint, tidak butuh cookie.
- [x] **W-11** `Navbar.astro` — Selalu tampilkan "Login" tanpa auth-aware state. Pengguna login tetap lihat "Login"
  - **Fix**: Buat `NavbarActions.tsx` React island — baca `ec_user` dari localStorage (disimpan saat login/register berhasil), tampilkan "Hi, {name} + Logout" atau "Login". Buat `pages/api/auth/logout.ts` sebagai proxy ke auth service. Update `Navbar.astro` mount kedua island.
- [x] **W-12** `checkout.astro` + `CheckoutForm.tsx` — User email diteruskan via DOM attribute `data-user-email` lalu dibaca dengan `document.querySelector`
  - **Fix**: Teruskan `userEmail` sebagai prop ke `CheckoutForm`, hapus `<span data-user-email>` dari template. `CheckoutForm` terima `userEmail: string` dan gunakan langsung.
- [x] **W-13** `runtime.ts` — `AppRuntime.runPromise(effect as any)` — `as any` menghapus typed error channel Effect. `runEffect` wrapper tidak dipakai di mana-mana.
  - **Fix**: Hapus seluruh `runEffect` function. Hanya export `AppRuntime` — konsumen pakai `runPromiseExit` langsung yang preserve typed errors.
- [x] **W-14** `middleware.ts` — `NetworkError` (gateway down) → redirect ke login. User ter-logout saat gateway restart
  - **Fix**: Import `Cause` dari effect + `NetworkError` dari errors. Gunakan `Cause.failureOption()` untuk inspeksi error type. `NetworkError` → fail-open (lanjut ke page). Auth/Http errors → redirect ke login seperti sebelumnya.

---

## P2 — Nice to Have (refactor backlog)

- [ ] **W-15** `pages/index.astro`, `pages/products/index.astro`, `pages/account/orders.astro`, `pages/orders/[cartId].astro` — Tidak pakai `Layout.astro`, masing-masing tulis `<!DOCTYPE html>` sendiri → duplikasi, meta tag tidak konsisten
  - **Fix**: Refactor semua page pakai `<Layout title="...">` wrapper
- [ ] **W-16** `ProductFilters.tsx` — Filter state tidak di-sync ke URL. Refresh page → filter hilang, hasil filter tidak bisa di-share/bookmark
  - **Fix**: Gunakan `URLSearchParams` dan `history.replaceState` atau Astro `navigate()` saat filter berubah
- [ ] **W-17** `tsconfig.json` — `@repo/ui/*` alias ada di tsconfig tapi package tidak ada di `dependencies` di `package.json`
  - **Fix**: Hapus alias jika package belum ada, atau tambahkan `"@repo/ui": "workspace:*"` ke dependencies
- [ ] **W-18** `checkout.astro` — Midtrans Snap URL hardcode ke sandbox: `app.sandbox.midtrans.com`
  - **Fix**: Gunakan `import.meta.env.PUBLIC_MIDTRANS_ENV === "production" ? "app.midtrans.com" : "app.sandbox.midtrans.com"`
- [x] **W-19** `LoginForm.tsx` L29–32 — `Effect.gen` yang hanya berisi satu `yield*` tanpa transformasi → redundant wrapper, noise
  - **Fix**: Hapus `Effect.gen`, panggil `authApi.login(values)` langsung ke `AppRuntime.runPromiseExit`. Sekaligus perbaiki `?redirect=` handling dengan origin validation untuk cegah open redirect.
- [ ] **W-20** `pages/orders/[cartId].astro` — Route param diberi nama `cartId` tapi isinya adalah `orderId`
  - **Fix**: Rename file ke `[orderId].astro`, update semua referensi

---

## Monorepo Integration

- [ ] **M-01** Tambahkan `"@repo/ui": "workspace:*"` ke `package.json` dependencies atau hapus path alias `@repo/ui/*` dari `tsconfig.json`
- [x] `@repo/common` ✅ dipakai benar di `products.ts` dan `ProductFilters.tsx`
- [x] `@repo/env` ✅ ada di dependencies
- [x] pnpm workspace ✅ configured
- [x] TypeScript strict mode ✅ aktif via `astro/tsconfigs/strict`

---

## Security Checklist

- [x] CSP header via `middleware.ts` — sudah ada, coverage baik ✅
- [x] CSRF origin check di Astro API routes ✅
- [x] Auth cookie forwarding server-side via `cookie` prop — tidak bocor ke client ✅
- [x] `sanitizeUpstreamError` di `payment/initiate.ts` — tidak forward internal paths ✅
- [x] Open redirect di `?redirect=` param — LoginForm sekarang validasi `url.origin === window.location.origin` sebelum redirect ✅
- [ ] **W-18** Midtrans sandbox URL hardcoded — harus pakai env switching
- [ ] `/account/login` tidak redirect ke home jika user sudah login (bisa login lagi)

---

## Progress Summary

| Priority | Total | Selesai |
|---|---|---|
| P0 | 5 | 5 ✅ |
| P1 | 9 | 9 ✅ |
| P2 | 6 | 2 ✅ |
| Monorepo | 2 | 0 |
| Security | 6 | 5 ✅ |

**Remaining open items**: W-15, W-16, W-17, W-18, W-20, M-01

# Admin2 — Audit Todo List

Hasil analisa mendalam pada `apps/admin2`. Diurutkan berdasarkan prioritas.

---

## 🔴 P0 — Critical (App tidak bisa jalan, harus fix sekarang)

- [ ] **[P0-1] Fix missing imports di `__root.tsx`**
  - Tambah `redirect` dan `useRouterState` ke import dari `@tanstack/react-router`
  - Tambah `import { Suspense } from 'react'`
  - File: `src/routes/__root.tsx`

- [ ] **[P0-2] Hapus stray `e` di `dashboard.route.tsx` line 156**
  - Ganti `e` dengan `export { DashboardSkeleton }` atau hapus jika tidak dibutuhkan
  - File: `src/routes/dashboard.route.tsx`

- [ ] **[P0-3] Fix broken login form — triple bug**
  - Hapus `useForm` setup yang tidak dipakai (inputs sudah pakai `useState`)
  - Fix typo resolver: `effectTsResolver` → `effecTsResolver` (atau hapus seluruh `useForm`)
  - Hapus `const handleSubmit` yang meng-shadow `handleSubmit` dari `useForm`
  - File: `src/routes/login.route.tsx`

- [ ] **[P0-4] Fix login role check — OWNER & FINANCE tidak bisa masuk**
  - Ubah `if (role !== "ADMIN")` menjadi `if (!role || !hasAnyAdminRole(role))`
  - Import `hasAnyAdminRole` dari `@/lib/rbac`
  - File: `src/routes/login.route.tsx`

- [ ] **[P0-5] Fix route conflict — `products.route.tsx` vs `products.index.tsx`**
  - Keduanya mendefinisikan `createFileRoute('/products/')` — TanStack Router hanya ambil satu
  - Pindahkan `loader` + `beforeLoad` + `component: lazy(...)` ke `products.route.tsx` sebagai parent layout
  - `products.index.tsx` jadikan actual page component
  - File: `src/routes/products.route.tsx`, `src/routes/products.index.tsx`

- [ ] **[P0-6] Fix route conflict — `audit-logs.route.tsx` vs `audit-logs.index.tsx`**
  - Pola sama dengan P0-5: keduanya define `createFileRoute('/audit-logs/')`
  - `AuditLogsPage` di `audit-logs.route.tsx` tidak pernah render karena di-override stub
  - File: `src/routes/audit-logs.route.tsx`, `src/routes/audit-logs.index.tsx`

---

## 🟠 P1 — High (Harus fix sprint ini)

- [ ] **[P1-1] Fix `errorComponent` di `__root.tsx` — render Outlet saat error**
  - `errorComponent` sekarang render `<Outlet />` alih-alih menampilkan error message
  - Parameter `props` (berisi `props.error`) tidak digunakan sama sekali
  - Ganti dengan UI error yang informatif dan tombol "Go to dashboard"
  - File: `src/routes/__root.tsx`

- [ ] **[P1-2] Hapus `src/types/index.ts` — dead code**
  - `UserRole` di sini hanya `"CUSTOMER" | "ADMIN"` — sudah ketinggalan (hilang `OWNER`, `FINANCE`)
  - Semua bagian kode sudah pakai tipe dari `src/lib/auth.ts`
  - File: `src/types/index.ts`

- [ ] **[P1-3] Hapus duplikasi `decodeOrThrow` dan `stripUndefined` di `products.ts`**
  - Kedua fungsi sudah ada di `src/server/_utils.ts` dan dipakai oleh `orders.ts` + `audit-logs.ts`
  - `products.ts` punya versi lokalnya sendiri → potensi drift
  - Ganti dengan `import { decodeOrThrow, stripUndefined } from './_utils'`
  - File: `src/server/products.ts`

- [ ] **[P1-4] Hapus singleton `QueryClient` di `src/lib/query-client.ts`**
  - File ini membuat instance `QueryClient` yang tidak pernah di-import di mana pun
  - `router.tsx` sudah punya `makeQueryClient()` yang dipakai SSR
  - File: `src/lib/query-client.ts`

- [ ] **[P1-5] Tambah SSR loader + debounce search di `customers-page.tsx`**
  - Tidak ada `loader` di customers route → selalu ada skeleton flash pada first render
  - Search input tidak punya debounce → API call setiap keystroke
  - Implementasi: debounce 300ms dengan `useRef` (sama seperti `products-page.tsx`)
  - File: `src/routes/customers.route.tsx`, `src/routes/customers-page.tsx`

- [ ] **[P1-6] Fix unsafe type cast `(row.original as any).id` di `customers-page.tsx`**
  - `User` type dari `@repo/common` sudah punya `id: string` — tidak perlu cast `any`
  - Ganti dengan `row.original.id`
  - File: `src/routes/customers-page.tsx`

---

## 🟡 P2 — Nice to Have (Backlog)

- [ ] **[P2-1] Tambah SSR loader di `orders.$orderId.tsx`**
  - Detail order selalu fetch client-side — tidak ada SSR, tidak ada `initialData`
  - Tambah `loader: ({ params }) => getOrderFn({ data: { id: params.orderId } })`
  - File: `src/routes/orders.$orderId.tsx`

- [ ] **[P2-2] Dashboard — stop polling saat tab tidak aktif**
  - Tambah `refetchIntervalInBackground: false` di query config dashboard
  - File: `src/routes/dashboard.route.tsx`

- [ ] **[P2-3] Hapus duplikasi tipe di `effect/Services.ts`**
  - `Product`, `User`, dll didefinisikan ulang di `Services.ts` "untuk menghindari cross-package resolution"
  - Padahal `@repo/common` sudah ada di dependencies — import langsung lebih aman
  - File: `src/effect/Services.ts`

- [ ] **[P2-4] Guard devtools agar tidak masuk production bundle**
  - `TanStackRouterDevtools` dan `ReactQueryDevtools` di-render tanpa kondisi
  - Bungkus dengan `import.meta.env.DEV && <DevTools />`
  - File: `src/routes/__root.tsx`

- [ ] **[P2-5] Tambah `aria-label` di Topbar logout button**
  - `<button onClick={handleLogout}>Logout</button>` — tidak ada aria-label eksplisit
  - File: `src/components/layout/topbar.tsx`

- [ ] **[P2-6] Tambah `aria-label` di customers search input**
  - `<input placeholder="Search by name or email...">` tanpa `aria-label`
  - File: `src/routes/customers-page.tsx`

- [ ] **[P2-7] Migrasi `ProductForm` ke `react-hook-form`**
  - Form saat ini pakai 5 `useState` terpisah per field — verbose dan rawan re-render
  - `react-hook-form` sudah terpasang sebagai dependency
  - File: `src/components/forms/product-form.tsx`

- [ ] **[P2-8] Konsistensi pattern code splitting antara products dan orders**
  - `products.route.tsx`: `component: lazy(() => import('./products-page'))`
  - `orders.route.tsx`: `const OrdersPage = lazy(...)` kemudian `component: OrdersPage`
  - Pilih satu pola dan terapkan konsisten
  - File: `src/routes/products.route.tsx`, `src/routes/orders.route.tsx`

- [ ] **[P2-9] Tambah test coverage**
  - Tidak ada unit test, integration test, atau e2e test sama sekali
  - Prioritas: RBAC logic (`src/lib/rbac.ts`), `decodeOrThrow` (`src/server/_utils.ts`)
  - Tool yang sudah ada di monorepo: `vitest`

- [ ] **[P2-10] Fix dependency version mismatch**
  - `apps/admin2/package.json`: `typescript: ^6.0.2`
  - Root `package.json`: `typescript: ^5.4.0`
  - Sinkronkan ke versi yang sama untuk menghindari konflik build

---

## Ringkasan Jumlah Temuan

| Prioritas | Jumlah | Status |
|-----------|--------|--------|
| 🔴 P0 Critical | 6 | ⬜ Open |
| 🟠 P1 High | 6 | ⬜ Open |
| 🟡 P2 Nice to Have | 10 | ⬜ Open |
| **Total** | **22** | |

---

*Generated: 2026-05-17 — audit by principal frontend engineer*

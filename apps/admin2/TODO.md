# Admin2 — Audit Todo List

Hasil analisa mendalam pada `apps/admin2`. Diurutkan berdasarkan prioritas.

---

## 🔴 P0 — Critical (App tidak bisa jalan, harus fix sekarang)

- [x] **[P0-1] Fix missing imports di `__root.tsx`**
  - Tambah `redirect` dan `useRouterState` ke import dari `@tanstack/react-router`
  - Tambah `import { Suspense } from 'react'`
  - File: `src/routes/__root.tsx`

- [x] **[P0-2] Hapus stray `e` di `dashboard.route.tsx` line 156**
  - Ganti `e` dengan `export { DashboardSkeleton }` atau hapus jika tidak dibutuhkan
  - File: `src/routes/dashboard.route.tsx` → komponen dipindah ke `dashboard-page.tsx`

- [x] **[P0-3] Fix broken login form — triple bug**
  - Hapus `useForm` setup yang tidak dipakai (inputs sudah pakai `useState`)
  - Fix typo resolver: `effectTsResolver` → `effecTsResolver` (atau hapus seluruh `useForm`)
  - Hapus `const handleSubmit` yang meng-shadow `handleSubmit` dari `useForm`
  - File: `src/routes/login.index.tsx` (komponen dipindah ke sini)

- [x] **[P0-4] Fix login role check — OWNER & FINANCE tidak bisa masuk**
  - Ubah `if (role !== "ADMIN")` menjadi `if (!role || !hasAnyAdminRole(role))`
  - Import `hasAnyAdminRole` dari `@/lib/rbac`
  - File: `src/routes/login.index.tsx`

- [x] **[P0-5] Fix route conflict — `products.route.tsx` vs `products.index.tsx`**
  - `products.route.tsx` → parent layout `/products` dengan `<Outlet />`, loader, RBAC
  - `products.index.tsx` → actual page `/products/` lazy import ProductsPage
  - File: `src/routes/products.route.tsx`, `src/routes/products.index.tsx`

- [x] **[P0-6] Fix route conflict — `audit-logs.route.tsx` vs `audit-logs.index.tsx`**
  - `audit-logs.route.tsx` → parent layout `/audit-logs` dengan `<Outlet />`, loader, RBAC
  - `audit-logs.index.tsx` → actual page `/audit-logs/` lazy import AuditLogsPage
  - `audit-logs-page.tsx` → file baru berisi komponen AuditLogsPage
  - File: `src/routes/audit-logs.route.tsx`, `src/routes/audit-logs.index.tsx`, `src/routes/audit-logs-page.tsx`

- [x] **[BONUS] Fix semua route conflicts lainnya (dashboard, orders, customers, login)**
  - Semua `*.route.tsx` diubah ke parent layout pattern (`/path` tanpa trailing slash, `<Outlet />`)
  - Semua `*.index.tsx` diubah ke actual page dengan lazy import
  - `dashboard-page.tsx` → file baru berisi DashboardPage

- [x] **[BONUS] Rewrite `routeTree.gen.ts`**
  - File lama masih berisi route template lama (`posts`, `users`, `deferred`) yang filenya tidak ada
  - Ditulis ulang dengan semua admin routes yang benar
  - File: `src/routeTree.gen.ts`

- [x] **[BONUS] Fix errorComponent di `__root.tsx`**
  - Render `error.message` dengan UI informatif + link ke dashboard
  - Pindahkan `<ErrorBoundary>` + `<Suspense>` ke layout utama
  - Guard devtools dengan `import.meta.env.DEV`

- [x] **[BONUS] Fix missing `redirect` import di `src/routes/index.tsx`**

---

## 🟠 P1 — High (Harus fix sprint ini)

- [x] **[P1-1] Fix `errorComponent` di `__root.tsx` — render Outlet saat error**
  - Selesai sebagai bagian dari P0-1 fix

- [x] **[P1-2] Hapus `src/types/index.ts` — dead code**
  - `UserRole` di sini hanya `"CUSTOMER" | "ADMIN"` — sudah ketinggalan (hilang `OWNER`, `FINANCE`)
  - File dikosongkan dengan komentar pengarahan ke `src/lib/auth.ts`
  - File: `src/types/index.ts`

- [x] **[P1-3] Hapus duplikasi `decodeOrThrow` dan `stripUndefined` di `products.ts`**
  - Fungsi lokal dihapus, diganti dengan `import { decodeOrThrow, stripUndefined } from './_utils'`
  - File: `src/server/products.ts`

- [x] **[P1-4] Hapus singleton `QueryClient` di `src/lib/query-client.ts`**
  - File dikosongkan dengan komentar penjelasan mengapa singleton berbahaya di SSR
  - File: `src/lib/query-client.ts`

- [x] **[P1-5] Tambah SSR loader + debounce search di `customers-page.tsx`**
  - Buat `src/server/customers.ts` dengan `listCustomersFn` (Effect pattern, sama dengan orders.ts)
  - `customers.route.tsx` — tambah `loader: () => listCustomersFn({ data: { page: 1 } })`
  - `customers-page.tsx` — pisahkan `inputValue` (display) vs `search` (debounced query)
  - Debounce 300ms pakai `useRef<setTimeout>`, `initialData` dari `Route.useLoaderData()`
  - File: `src/server/customers.ts`, `src/routes/customers.route.tsx`, `src/routes/customers-page.tsx`

- [x] **[P1-6] Fix unsafe type cast `(row.original as any).id` di `customers-page.tsx`**
  - Diganti dengan `row.original.id` — `User` dari `@repo/common` punya `id: string`
  - File: `src/routes/customers-page.tsx`

---

## 🟡 P2 — Nice to Have (Backlog)

- [ ] **[P2-1] Tambah SSR loader di `orders.$orderId.tsx`**
  - Detail order selalu fetch client-side — tidak ada SSR, tidak ada `initialData`
  - Tambah `loader: ({ params }) => getOrderFn({ data: { id: params.orderId } })`
  - File: `src/routes/orders.$orderId.tsx`

- [x] **[P2-2] Dashboard — stop polling saat tab tidak aktif**
  - `refetchIntervalInBackground: false` sudah ditambahkan di `dashboard-page.tsx`
  - File: `src/routes/dashboard-page.tsx`

- [ ] **[P2-3] Hapus duplikasi tipe di `effect/Services.ts`**
  - `Product`, `User`, dll didefinisikan ulang di `Services.ts` "untuk menghindari cross-package resolution"
  - Padahal `@repo/common` sudah ada di dependencies — import langsung lebih aman
  - File: `src/effect/Services.ts`

- [x] **[P2-4] Guard devtools agar tidak masuk production bundle**
  - `TanStackRouterDevtools` dan `ReactQueryDevtools` sekarang dibungkus `import.meta.env.DEV`
  - File: `src/routes/__root.tsx`

- [ ] **[P2-5] Tambah `aria-label` di Topbar logout button**
  - `<button onClick={handleLogout}>Logout</button>` — tidak ada aria-label eksplisit
  - File: `src/components/layout/topbar.tsx`

- [x] **[P2-6] Tambah `aria-label` di customers search input**
  - Ditambahkan sekaligus saat P1-5: `aria-label="Search customers by name or email"`
  - File: `src/routes/customers-page.tsx`

- [ ] **[P2-7] Migrasi `ProductForm` ke `react-hook-form`**
  - Form saat ini pakai 5 `useState` terpisah per field — verbose dan rawan re-render
  - `react-hook-form` sudah terpasang sebagai dependency
  - File: `src/components/forms/product-form.tsx`

- [ ] **[P2-8] Konsistensi pattern code splitting antara products dan orders**
  - `products.index.tsx`: `const ProductsPage = lazy(...)` kemudian `component: ProductsPage`
  - `orders.index.tsx`: sama
  - Pola sudah konsisten setelah P0 fix

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

| Prioritas | Total | Selesai | Sisa |
|-----------|-------|---------|------|
| 🔴 P0 Critical | 6 (+4 bonus) | ✅ 10 | 0 |
| 🟠 P1 High | 6 | ✅ 1 | 5 |
| 🟡 P2 Nice to Have | 10 | ✅ 2 | 8 |
| **Total** | **22** | **13** | **9** |

---

*Generated: 2026-05-17 — audit by principal frontend engineer*
*Last updated: 2026-05-17 — P0 fixes applied*

# Admin App — Consistency Audit & Todo List

> Dihasilkan dari analisis menyeluruh `apps/admin` pada Mei 2026.
> Update checklist ini setiap ada item yang diselesaikan.

---

## Skor Per Kategori

| Kategori | Skor | Alasan Singkat |
|----------|------|----------------|
| Konsistensi Kode | 6/10 | Import order tidak deterministik; `as any` cast di route files |
| State Management | 8/10 | URL-as-state, optimistic update, SSR hydration — sudah bagus |
| API & Data Layer | 4/10 | Dua sistem fetch hidup berdampingan tanpa aturan kapan pakai mana |
| UI & Styling | 5/10 | `product-form.tsx` raw HTML vs `login-page.tsx` pakai design system |
| Folder & File Structure | 8/10 | Flat routing konsisten; `Services.ts` terlalu besar (>200 baris) |
| Monorepo Standards | 7/10 | Ghost dep `redaxios`; tidak ada pre-commit hook; UserRole incomplete |

---

## P1 — Harus Dikerjakan Segera (DX Blocker)

- [x] **FORM-01** Refactor `src/components/forms/product-form.tsx` — ganti raw HTML
  (`<input>`, `<label>`, `<textarea>`, `<button>`) dengan `@repo/ui` components
  (`Field`, `FieldLabel`, `FieldError`, `Input`, `Textarea`, `Button`).
  _Referensi standar: `login-page.tsx`._

- [x] **DEP-01** Hapus `redaxios` dari `apps/admin/package.json` — tidak digunakan di
  mana pun, native `fetch` dipakai di `lib/api.ts`.

- [x] **TYPE-01** Tambah `ProductStatus` ke `packages/common/src/types/index.ts` dan
  update `Product` dengan `status?: ProductStatus`. Perbaiki `UserRole` agar mencakup
  semua role admin (`OWNER`, `ADMIN`, `FINANCE`, `CUSTOMER`).

- [x] **TYPE-02** Hapus definisi inline `ProductStatus` dari `Services.ts` — import dari
  `@repo/common`. Tambah komentar divergensi yang jelas untuk `Product`, `User`,
  `NewProduct` yang masih berbeda dari `@repo/common`.

- [x] **TS-01** Hapus `as any` cast pada `redirect({ to: "/dashboard" as any })` di
  `products.route.tsx` — TanStack Router v1 punya full type support.

---

## P2 — Harus Dikerjakan Sprint Ini

- [x] **IMPORT-01** Konfigurasi `importOrder` di `prettier.config.cjs` — sudah diupdate
  dengan 7 grup resmi. Import order di semua route dan page files sudah difix manual.
  Jalankan perintah berikut sekali saat `pnpm install` berhasil untuk otomatisasi
  sisa file (server/, effect/, lib/, components/):
  ```bash
  pnpm run format:write
  ```

- [x] **QK-01** Standardisasi format query key ke object form di semua `*-page.tsx`:
  ```ts
  // Sebelum
  queryKey: ["products", page, search]
  // Sesudah
  queryKey: ["products", { page, search }]
  ```
  Difix di: `products-page`, `orders-page`, `customers-page`, `audit-logs-page`.
  `dashboard-page` tidak perlu — `queryKey: ["dashboard-stats"]` sudah final (tanpa param).

- [x] **SEARCH-01** Ganti raw `<input>` di `products-page.tsx` (search bar) dan
  `customers-page.tsx` dengan `@repo/ui Input` — kedua file selesai. `className` Tailwind
  inline dihapus; styling diserahkan ke design system.

- [x] **RBAC-01** `beforeLoad` RBAC guard ditambahkan ke `orders.route.tsx`
  (`orders:read`) dan `customers.route.tsx` (`customers:read`) mengikuti pola persis dari
  `products.route.tsx`. `audit-logs.route.tsx` sudah punya guard (`audit:read`) — sisa
  `as any` cast pada `redirect` juga dihapus sekalian.

- [x] **HOOK-01** Husky v9 + lint-staged v15 dikonfigurasi di root monorepo.
  `"prepare": "husky"` ditambahkan ke `scripts`; `lint-staged` config di `package.json`
  menjalankan `prettier --write --cache` pada semua file `*.{ts,tsx,mdx,json,css,md}`
  yang di-stage. Hook `.husky/pre-commit` berisi `pnpm lint-staged`.
  Jalankan `pnpm install` sekali untuk mengaktifkan (Replit environment tidak mendukung
  network install saat sesi agent berjalan).

---

## P3 — Backlog Teknis

- [x] **TYPE-03** Unifikasi penuh tipe `Product` dan `NewProduct` antara `@repo/common`
  dan `Services.ts`.
  - `@repo/common/Product` — ditambahkan `comparePrice?: number`
  - `@repo/common/NewProduct` — `slug` dijadikan optional (backend auto-generate); ditambahkan `status?: ProductStatus` dan `comparePrice?: number`
  - `Services.schemas.ts Product` — ditambahkan `slug?`, `categoryId?`, `isActive?`, `comparePrice?` agar alignment penuh dengan `@repo/common`
  - `Services.schemas.ts NewProduct` — ditambahkan `slug?`, `categoryId?`, `comparePrice?`
  - `Services.schemas.ts User` — local type dihapus; sekarang `import type { User } from "@repo/common"` (UserRole sudah mencakup semua role sejak TYPE-01)
  - `ProductSchema` dan `NewProductSchema` (Effect.Schema) diperbarui sesuai field baru
  - Semua komentar `NOTE(TYPE-03)` dihapus

- [x] **TYPE-04** 4 response types dipindah ke `src/types/api-responses.ts`:
  `OrderSummary`, `OrderDetail`, `DashboardStats`, `AuditLogEntry`.
  - `src/types/index.ts` — barrel baru untuk semua admin response types
  - `Services.schemas.ts` → `from "@/types"` (bukan lagi `@/lib/api`)
  - `Services.api.ts` → `from "@/types"` untuk 4 types ini; tetap
    `from "./Services.schemas"` untuk `Product`, `NewProduct`, `User`
  - `lib/api.ts` → re-ekspor dari `@/types` untuk backward compat
  - Ketergantungan terbalik (Effect layer → client layer) **dihilangkan**.
  - **Skip `@repo/common`**: shape admin diverge dari `@repo/common/OrderDetail`
    (field `productName` vs `name`, tidak ada `totalAmount`) — reconcile dengan
    order-service team saat TYPE-03.

- [x] **REFRESH-01** `silentRefresh` interceptor dipasang di dua titik:
  - `__root.tsx` `beforeLoad` — jika `getSession()` null, coba refresh dulu sebelum
    redirect ke login. Token kedaluwarsa tidak langsung logout user.
  - `router.tsx` `QueryCache` + `MutationCache` `onError` — setiap query/mutation yang
    gagal dengan 401 (`ApiError.status === 401` atau `UnauthorizedError`) otomatis
    memanggil `silentRefresh()` + `queryClient.invalidateQueries()`. Cooldown 10 detik
    mencegah refresh loop; jika masih 401 setelahnya → `window.location.href = "/login"`.

- [x] **LAYER-01** Migrasi `authApi` dari `lib/api.ts` ke server function di
  `src/server/auth.ts`. `loginFn` dan `logoutFn` dibuat dengan cookie forwarding
  via `appendResponseHeader` + `getCookies` dari `@tanstack/react-start/server`.
  `login-page.tsx` dan `topbar.tsx` diupdate ke server functions. `lib/api.ts`
  sekarang hanya berisi `silentRefresh` (diekspor) dan re-ekspor response types.

- [x] **LAYER-02** Migrasi selesai — semua page (`audit-logs-page`, `dashboard-page`,
  `orders-page`, `orders.$orderId`, `products-page`, `customers-page`) sudah menggunakan
  server functions dari `src/server/*.ts` (Effect + `ApiClientService`). Dead code
  `productsApi`, `ordersApi`, `customersApi`, `dashboardApi`, `auditLogsApi` dihapus dari
  `lib/api.ts`. File sekarang hanya berisi `authApi` (butuh cookie + `window.location`)
  dan 4 type definitions (`OrderSummary`, `OrderDetail`, `DashboardStats`, `AuditLogEntry`)
  yang masih di-re-ekspor oleh `Services.schemas.ts` (akan dipindahkan saat TYPE-04).

- [x] **SPLIT-01** `src/effect/Services.ts` (261 baris) dipecah menjadi 3 file:
  - `Services.config.ts` (19 baris) — `ConfigService` + env var reads
  - `Services.schemas.ts` (101 baris) — semua type defs + `Schema.Struct` + re-exports dari `lib/api`
  - `Services.api.ts` (145 baris) — `ApiClientService` + semua method (products, orders, customers, dashboard, auditLogs)
  - `Services.ts` dijadikan barrel (12 baris) — `export * from` ketiga sub-module.
  Semua 11 importer lama (`from "@/effect/Services"`) tetap berjalan tanpa perubahan.
  Kode baru sebaiknya import langsung dari sub-module yang relevan.

- [x] **TOKEN-01** Semua hardcoded `text-gray-*` / `bg-gray-*` / `border-gray-*` di
  14 files (route + component) diganti dengan semantic Tailwind v4 tokens.
  Mapping yang digunakan:
  - `text-gray-{900,800,700}` → `text-foreground`
  - `text-gray-{600,500,400}` → `text-muted-foreground`
  - `bg-gray-{100,200}` → `bg-muted` (skeleton/surface)
  - `bg-gray-50` → `bg-muted/40` (page background)
  - `border-gray-200` → `border-border`
  - `bg-white border-gray-200` (card pattern) → `bg-card border-border`
  - `dark:text-gray-400` dihapus (semantic token sudah adapt dark mode)
  **SKIP**: `sidebar.tsx` — palette dark (`bg-gray-900`, `bg-gray-800`, `text-gray-300`,
  `border-gray-800`) adalah desain sidebar yang disengaja, bukan hardcoded accidental.

- [x] **BARREL-01** Barrel exports dibuat dan semua consumer dimigrasikan:
  - `src/components/index.ts` — re-ekspor `ErrorBoundary`, `NotFound`, `DataTable`,
    `ProductForm`, `Sidebar`, `Topbar`
  - `src/lib/index.ts` — re-ekspor semua dari `api`, `auth`, `effect-resolver`,
    `rbac`, `session-context` (values + types)
  - 13 file consumer (routes + components) diupdate ke `from "@/lib"` / `from "@/components"`
  - **SKIP** file internal lib (`session-context.tsx` → `@/lib/auth`) — import diretto
    dipertahankan untuk menghindari circular dependency.

---

## Standar Resmi yang Sudah Didefinisikan

### File naming
```
feature.route.tsx   ← RBAC guard + validateSearch + loader (no component logic)
feature.index.tsx   ← lazy(() => import("./feature-page"))
feature-page.tsx    ← UI heavy component (default export)
feature.$param.tsx  ← detail page (bisa juga pakai -page.tsx pattern)
```

### Import order (target setelah IMPORT-01 selesai)
```ts
// 1. React core
import { useState, useCallback } from "react"

// 2. Third-party non-Tanstack
import { useForm } from "react-hook-form"
import { EyeIcon } from "lucide-react"

// 3. @tanstack/*
import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

// 4. @repo/* (workspace shared packages)
import type { Product } from "@repo/common"
import { Button } from "@repo/ui/components/button"

// 5. @/server/*
import { listProductsFn } from "@/server/products"

// 6. @/effect/*
import { effectResolver } from "@/lib/effect-resolver"

// 7. @/lib/*
import { can } from "@/lib/rbac"

// 8. @/schemas/*
import { LoginSchema } from "@/schemas/forms"

// 9. @/components/*
import { DataTable } from "@/components/data-table/data-table"

// 10. Relative (./Route self-reference selalu paling akhir)
import { Route } from "./products.route"
```

### Form component pattern (standar @repo/ui)
```tsx
<FieldGroup>
  <Field data-invalid={!!errors.fieldName}>
    <FieldLabel htmlFor="field-id">Label</FieldLabel>
    <Input id="field-id" {...register("fieldName")} />
    {errors.fieldName && <FieldError errors={[errors.fieldName]} />}
  </Field>
</FieldGroup>
<Button type="submit" disabled={isLoading}>
  {isLoading ? "Saving..." : "Save"}
</Button>
```

### Query key pattern
```ts
// object-form — lebih readable di devtools, mudah di-match partial
queryKey: ["products", { page, search }]
queryKey: ["orders",   { page, status }]
queryKey: ["customers",{ page, search }]
```

### Data fetching rule
```
login/logout/refresh → lib/api.ts (butuh window.location + cookie handling)
semua data lainnya  → src/server/*.ts (Effect server function)
```

---

## Codemod & Autofix Scripts

### 1. Hapus `redaxios` (sudah dilakukan)
```bash
pnpm --filter admin remove redaxios
```

### 2. Fix semua import order setelah konfigurasi prettier
```bash
pnpm --filter admin prettier --write "src/**/*.{ts,tsx}"
```

### 3. Cari semua raw `<input>` / `<label>` / `<button>` di routes dan components
```bash
grep -rn "<input\b\|<label\b\|<textarea\b\|<button\b" \
  apps/admin/src/routes/ apps/admin/src/components/ \
  --include="*.tsx" | grep -v "node_modules"
```

### 4. Cari semua `as any` yang tersisa
```bash
grep -rn "as any" apps/admin/src/ --include="*.ts" --include="*.tsx" \
  | grep -v "routeTree.gen\|node_modules"
```

### 5. Cari query key yang masih pakai tuple positional
```bash
grep -rn 'queryKey: \[.*page.*search\|queryKey: \[.*page.*status' \
  apps/admin/src/ --include="*.tsx"
```

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

- [ ] **QK-01** Standardisasi format query key ke object form di semua `*-page.tsx`:
  ```ts
  // Sebelum
  queryKey: ["products", page, search]
  // Sesudah
  queryKey: ["products", { page, search }]
  ```
  Berlaku untuk: `products-page`, `orders-page`, `customers-page`, `audit-logs-page`,
  `dashboard-page`.

- [ ] **SEARCH-01** Ganti raw `<input>` di `products-page.tsx` (search bar) dan
  `customers-page.tsx` dengan `@repo/ui Input` — saat ini satu-satunya raw input yang
  tersisa di page-level.

- [ ] **RBAC-01** Tambah `beforeLoad` RBAC guard di `orders.route.tsx`,
  `customers.route.tsx`, `audit-logs.route.tsx` — saat ini hanya `products.route.tsx`
  yang punya per-route RBAC check eksplisit. Root guard yang ada memang sudah melindungi,
  tapi per-route guard lebih explicit dan mudah di-audit.

- [ ] **HOOK-01** Tambah Husky + lint-staged ke root `package.json` agar `prettier` +
  `eslint` berjalan otomatis setiap commit:
  ```bash
  pnpm add -D husky lint-staged -w
  pnpx husky init
  ```

---

## P3 — Backlog Teknis

- [ ] **TYPE-03** Unifikasi penuh tipe `Product` dan `NewProduct` antara `@repo/common`
  dan `Services.ts`. Saat ini ada divergensi field:
  - `@repo/common` punya `slug` (required), `isActive`, `categoryId`
  - `Services.ts` punya `status: ProductStatus` — tidak ada di `@repo/common`
  - `NewProduct` di `@repo/common` requires `slug`, admin form tidak punya field slug
  Butuh koordinasi dengan product-service team untuk reconcile kontrak API.

- [ ] **TYPE-04** Pindah tipe `OrderSummary`, `OrderDetail`, `DashboardStats`,
  `AuditLogEntry` dari `src/lib/api.ts` ke `packages/common` atau `src/types/`.
  Saat ini `Services.ts` mengimport dari `lib/api.ts` (layer lama) — ketergantungan
  terbalik yang harus dihilangkan.

- [ ] **LAYER-01** Migrasi `authApi` dari `lib/api.ts` ke server function di
  `src/server/auth.ts`. Saat ini `login-page.tsx` dan `topbar.tsx` masih pakai Layer A
  (client-side fetch). Setelah migrasi, `lib/api.ts` bisa di-scope hanya untuk
  `silentRefresh` interceptor.

- [ ] **LAYER-02** Migrasi `auditLogsApi` dan `dashboardApi` ke server functions —
  keduanya sudah ada di `ApiClientService` (Effect layer) tapi page-nya masih pakai
  `lib/api.ts` langsung.

- [ ] **SPLIT-01** Split `src/effect/Services.ts` (247 baris) menjadi 3 file:
  - `Services.config.ts` — `ConfigService`
  - `Services.schemas.ts` — semua `Schema.Struct` + inferred types
  - `Services.api.ts` — `ApiClientService`

- [ ] **TOKEN-01** Ganti hardcoded `text-gray-*` / `bg-gray-*` / `border-gray-*` di
  semua component dan page files dengan semantic Tailwind v4 tokens:
  `text-foreground`, `bg-background`, `border-border`, `text-muted-foreground`.
  Tailwind v4 + CSS variables dari `@repo/ui/globals.css` sudah mendukung ini.

- [ ] **BARREL-01** Tambah barrel export `src/components/index.ts` dan `src/lib/index.ts`
  — opsional, tapi memudahkan refactor besar. Hanya kalau team setuju dengan pattern ini.

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

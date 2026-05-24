# Contributing to `apps/admin`

Pattern guide derived from a full codebase consistency analysis (May 2026).
Follow these conventions for every new file or change in this app.

---

## Table of Contents

1. [Project structure](#1-project-structure)
2. [Naming conventions](#2-naming-conventions)
3. [Imports & barrel files](#3-imports--barrel-files)
4. [TanStack Query — query keys, staleTime, invalidation](#4-tanstack-query)
5. [Forms & validation](#5-forms--validation)
6. [Toast messages — language & severity](#6-toast-messages)
7. [Styling — Tailwind & shared components](#7-styling)
8. [Server functions](#8-server-functions)
9. [Route conventions](#9-route-conventions)
10. [TypeScript rules](#10-typescript-rules)

---

## 1. Project structure

```
src/
  components/          # UI — one folder per domain
    <domain>/          # e.g. products/, users/, queue/
      index.ts         # barrel: export public surface only
    data-table/        # reusable table + pagination
    layout/            # AppLayout, Sidebar, Header, CommandPalette
    forms/             # shared form components (ProductForm, etc.)
    shared/            # ErrorBoundary, ModuleEmptyState, FilterInput, …
    index.ts           # root barrel — for rare cross-domain imports
  routes/              # TanStack file-based routing
    <domain>/
      route.tsx        # loader + RBAC guard + validateSearch
      index.tsx        # lazy entry point (re-exports -page)
      -page.tsx        # page component (default export)
  server/              # TanStack Start createServerFn definitions
  effect/              # Effect-TS services, runtime, middleware
  lib/                 # hooks, utilities, query-keys, toast, rbac
    query-keys.ts      # ← canonical query key registry (see §4)
  schemas/             # Valibot form schemas
  types/               # API response shapes
```

---

## 2. Naming conventions

| Item | Convention | Example |
|------|-----------|---------|
| Component files | kebab-case | `invite-user-dialog.tsx` |
| Component names | PascalCase | `InviteUserDialog` |
| Route segments | kebab-case | `/audit-logs` |
| Server functions | camelCase + `Fn` suffix | `inviteUserFn` |
| Query key constants | use `queryKeys.*` | `queryKeys.adminUsers.all` |
| Valibot schemas | PascalCase + `Schema` | `ProductFormSchema` |
| Valibot types | PascalCase + `Fields` or `Values` | `ProductFormValues` |
| Hooks | camelCase + `use` prefix | `useRouteSearch` |

---

## 3. Imports & barrel files

### Rule: always use the most specific barrel that exists

```tsx
// ✅ correct — specific barrel
import { DataTable, PaginationBar } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState, FilterSelect } from "@/components/shared";
import { productColumns } from "@/components/products";
import { toast } from "@/lib";

// ❌ wrong — root barrel for components that have their own sub-barrel
import { DataTable } from "@/components";
// ❌ wrong — direct path bypassing lib barrel
import { toast } from "@/lib/toast";
```

### Import group order (enforced by convention)

```tsx
// 1. External packages — alphabetical within each group
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";

// 2. Monorepo packages
import { Button } from "@repo/ui/components/button";

// 3. App-internal — @/ aliases
import { listProductsFn } from "@/server/products";
import { DataTable, PaginationBar } from "@/components/data-table";
import { toast, queryKeys } from "@/lib";

// 4. Route-relative
import { Route } from "./route";
```

Blank lines between each group are required.

---

## 4. TanStack Query

### 4a. Always use `queryKeys` — never raw strings

```tsx
// ✅ correct
import { queryKeys } from "@/lib";

useQuery({ queryKey: queryKeys.products.list({ page, search }) });
queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

// ❌ wrong — raw string literals are typo-prone
useQuery({ queryKey: ["products", { page, search }] });
queryClient.invalidateQueries({ queryKey: ["products"] });
```

All keys are defined in `src/lib/query-keys.ts`. Add new ones there.

### 4b. `staleTime` tiers

| Scenario | Value | Where set |
|----------|-------|-----------|
| Default (list pages) | 60 s | `makeQueryClient()` in `router.tsx` |
| Entity detail pages | 5 min | Route `loader` |
| Settings / rarely-changing | `Infinity` | Component `useQuery` |
| Polling (live data) | Same as `refetchInterval` | Component `useQuery` |

Do not introduce new magic numbers — reuse these tiers or add a named constant.

### 4c. Invalidation after mutations

Always invalidate **all** queries that display the mutated data.
For queue mutations (retry / resend), invalidate all three:

```tsx
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats });
  void queryClient.invalidateQueries({ queryKey: queryKeys.queue.failedJobs });
  void queryClient.invalidateQueries({ queryKey: queryKeys.queue.activity });
},
```

Use `void` consistently on fire-and-forget `invalidateQueries` calls.

---

## 5. Forms & validation

### 5a. Use `@formisch/react` + Valibot for every form

```tsx
import { Form, useField, useForm } from "@formisch/react";
import * as v from "valibot";
import { ProductFormSchema } from "@/schemas/forms";

const form = useForm({ schema: ProductFormSchema, onSubmit: handleSubmit });
```

### 5b. All schemas live in `src/schemas/forms.ts`

Add new form schemas to that file. Do not inline schemas inside components.

### 5c. Manual `useState` for forms is not allowed

Even simple dialogs with 2-3 fields should use `useForm` + a Valibot schema.
This keeps validation logic co-located, typed, and testable.

### 5d. Validation error messages — Bahasa Indonesia

```ts
// ✅
v.minLength(1, "Email wajib diisi.")
v.check((n) => n > 0, "Harga harus lebih dari 0.")

// ❌ mix of languages
v.minLength(1, "Name is required.")
```

---

## 6. Toast messages

### Language rule

| Module | Language |
|--------|----------|
| customers, orders, products, users | Bahasa Indonesia |
| queue (technical ops) | English |
| auth / system errors | English |

### Severity guide

```tsx
toast.success("Produk berhasil dibuat");          // green — 3 s
toast.error("Gagal menghapus produk", err);        // red — 5 s, appends err.message
toast.warning("Stok produk hampir habis");         // yellow — 4 s
```

Always import from the `@/lib` barrel:

```tsx
import { toast } from "@/lib";
```

---

## 7. Styling

### Use `@repo/ui` components — never raw HTML equivalents

```tsx
// ✅
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

// ❌ raw HTML when a @repo/ui component exists
<button className="...">Save</button>
<input className="..." />
```

### Filter bars — use `FilterSelect` / `FilterInput`

For filter bars in route pages that use native `<select>` or `<input type="date">`:

```tsx
import { FilterInput, FilterSelect } from "@/components/shared";

<FilterSelect value={status} onChange={(e) => setFilter("status", e.target.value)}>
  <option value="">All statuses</option>
  ...
</FilterSelect>

<FilterInput type="date" value={date} onChange={(e) => setFilter("date", e.target.value)} />
```

Never duplicate the filter Tailwind class string — it lives in `src/components/shared/filter-input.tsx`.

### Tailwind class order

Follow the Tailwind recommended order: layout → box model → typography → visual → interactive.
Use `cn()` from `@repo/ui/lib/utils` for conditional class merging.

---

## 8. Server functions

All backend calls are TanStack Start `createServerFn` definitions in `src/server/`.
One file per domain. Naming: `<verb><Entity>Fn`.

```ts
// src/server/products.ts
export const createProductFn = createServerFn({ method: "POST" })
  .validator(decodeOrThrow(CreateProductInput))
  .handler(async ({ data }) => { ... });
```

- Input validation uses `decodeOrThrow()` from `src/server/_utils.ts`
- Errors bubble as typed `ValidationError` or plain `Error`
- No business logic in components — always call a server function

---

## 9. Route conventions

Every routed module uses a three-file pattern:

```
routes/<domain>/
  route.tsx     # Route definition: RBAC guard, validateSearch, loader
  index.tsx     # Lazy entry: <Outlet /> or re-export
  -page.tsx     # Default export: the actual page component
```

### `route.tsx` responsibilities

- `beforeLoad`: RBAC check using `can(session.role, "resource:action")`
- `validateSearch`: via `valibotValidator(searchSchema)` — schema in `src/lib/search-schemas.ts`
- `loader`: `queryClient.ensureQueryData(...)` with the canonical query key

### Loader `staleTime`

Loaders for entity detail pages set `staleTime: 5 * 60 * 1_000` so navigating
back to a visited page does not re-fetch within 5 minutes.

---

## 10. TypeScript rules

- `strict: true` — no `any`, no non-null assertions without a comment
- `noUncheckedIndexedAccess: true` — always guard array/object access
- `exactOptionalPropertyTypes: true` — pass `undefined` explicitly when needed
- Prefer `unknown` over `any` in `catch` clauses
- All API response shapes live in `src/types/api-responses.ts`

```ts
// ✅
} catch (err: unknown) {
  toast.error("Gagal", err);
}

// ❌
} catch (err: any) {
  toast.error(err.message);
}
```

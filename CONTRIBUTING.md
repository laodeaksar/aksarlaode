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

---

---

# Contributing to `apps/order-service`

Pattern guide derived from a full codebase consistency analysis (May 2026).
Follow these conventions for every new file or change in this service.

---

## Table of Contents

1. [Project structure](#os-1-project-structure)
2. [Naming conventions](#os-2-naming-conventions)
3. [Error handling — Effect-TS](#os-3-error-handling)
4. [DB access — repository pattern](#os-4-db-access)
5. [Validation & types](#os-5-validation--types)
6. [HTTP status mapping](#os-6-http-status-mapping)
7. [State machine](#os-7-state-machine)

---

## OS-1. Project structure

```
src/
  handlers/         # One file per route — thin, no DB access
    __tests__/      # Bun unit tests alongside handlers
  routes/           # Elysia route definitions + TypeBox schemas
  repository/       # All MongoDB access (Effect-TS wrappers)
  lib/              # Infrastructure: redis, rate-limiter, idempotency, ...
  types/            # Shared request body types (re-exports from @repo/database)
  workers/          # BullMQ workers for background jobs
```

The Mongoose model lives in `@repo/database/mongodb` — **not** in this service.
Import it from there:

```ts
import { OrderModel, type OrderStatus } from "@repo/database/mongodb";
```

---

## OS-2. Naming conventions

| Item | Convention | Example |
|------|-----------|---------|
| Handler files | kebab-case | `admin-order-note.ts` |
| Handler exports | camelCase + `Handler` suffix | `adminOrderNoteHandler` |
| Route file exports | camelCase + `Routes` suffix | `adminRoutes`, `orderRoutes` |
| Repository exports | namespace object | `orderRepository.findByOrderId(...)` |
| TypeBox schemas | PascalCase + `Schema` | `CreateOrderBodySchema` |
| Shared body types | PascalCase + `Body` | `CreateOrderBody`, `NoteBody` |
| Error classes | PascalCase + `Error` | `OrderNotFoundError`, `DbError` |

All shared request-body types go in `src/types/index.ts` — never define local
`type XxxBody` inside a handler file.

---

## OS-3. Error handling — Effect-TS

### Rule: no raw `try/catch` or `throw new Error(...)` in application code

Every error must be a `Data.TaggedError`:

```ts
// ✅ correct
class OrderNotFoundError extends Data.TaggedError("OrderNotFoundError")<{
  id: string;
}> {}

const fn = (id: string) =>
  Effect.tryPromise({
    try: () => OrderModel.findOne({ orderId: id }).lean(),
    catch: (e) => new DbError({ cause: e }),
  });

// ❌ wrong — raw throw
throw new Error("DB query failed");

// ❌ wrong — plain object fail
yield* Effect.fail({ _tag: "SomeError" as const });
```

### Error inspection in handlers

Use the `._tag` discriminant to match errors. Cast once with a typed interface:

```ts
const err = result.cause.error as { _tag: string };
if (err._tag === "OrderNotFoundError") { ... }
if (err._tag === "InvalidTransitionError") { ... }
```

### Exported errors

`OrderConflictError`, `InvalidTransitionError`, and `VALID_TRANSITIONS` are
exported from `order.repository.ts`. Import them instead of redefining:

```ts
import {
  OrderConflictError,
  InvalidTransitionError,
  VALID_TRANSITIONS,
} from "@/repository/order.repository";
```

### Logging levels

| Situation | Level | Method |
|-----------|-------|--------|
| Normal business event | info | `console.info(JSON.stringify({...}))` |
| Expected edge case (rate limit, fraud) | warn | `console.warn(JSON.stringify({...}))` |
| Unexpected failure | error | `console.error(JSON.stringify({...}))` |

All log lines must be **single JSON objects** — no raw string interpolation.

---

## OS-4. DB access — repository pattern

All MongoDB access goes through `orderRepository`. No handler may import
`OrderModel` directly.

### `findAll` / `exportOrders` / `summarize` — use the shared query builder

The `buildMatchQuery` helper inside the repository converts the standard filter
shape (`userId`, `status[]`, `dateFrom`, `dateTo`) into a MongoDB query object.
Do not duplicate this logic in new query methods — call or extend it instead.

### N+1 awareness

- `updateStatus` does two DB round-trips (read → write). When callers already
  have the document (e.g. `cancel.ts` via `checkOwnership`), they may validate
  the transition locally and skip the extra read.
- The reconciliation sweep loops over expired orders sequentially; stock release
  calls are parallelised within each order via `Effect.all`.

### Generator / cursor for large result sets

Any export or bulk operation that may return > 1 000 rows **must** use a
MongoDB cursor / async generator pattern — never buffer the full result set:

```ts
export async function* exportOrders(filters, maxRows = 50_000) {
  const cursor = OrderModel.find(query).limit(maxRows).lean().cursor();
  for await (const doc of cursor) yield doc;
}
```

---

## OS-5. Validation & types

### TypeBox schemas in routes, TypeScript types in `@/types`

Routes define TypeBox schemas for Elysia's runtime validation.
Handler code works with the corresponding TypeScript types from `@/types`.
Never duplicate a schema as a type — import and cast in the handler:

```ts
// routes/order.routes.ts
const CreateOrderBodySchema = t.Object({ ... });

// handlers/create.ts
import type { CreateOrderBody } from "@/types";
const input = body as CreateOrderBody;
```

### Pagination query params

`page` and `limit` are declared as `t.String()` in routes (Elysia receives them
as strings from the query string) and parsed with `Number()` in handlers.
Always clamp: `Math.max(1, Number(q.page ?? 1))` and `Math.min(100, ...)`.

### No `any` in aggregate callbacks

Mongoose `aggregate()` returns `unknown[]`. Use typed interfaces for pipeline
result shapes:

```ts
type RawStatusBucket = { _id: string; orderCount: number; ... };
(facetResult.byStatus as RawStatusBucket[]).map((b) => ({ ... }));
```

---

## OS-6. HTTP status mapping

| Situation | Status | `code` field |
|-----------|--------|--------------|
| Order not found | 404 | `ORDER_NOT_FOUND` |
| Not owner / forbidden role | 403 | `FORBIDDEN` |
| Invalid state transition | 422 | `INVALID_STATUS_TRANSITION` |
| Already in terminal state | 409 | `INVALID_STATUS_TRANSITION` |
| Duplicate order / in-flight | 409 | `DUPLICATE_ORDER_ID` / `REQUEST_IN_FLIGHT` |
| Rate limited | 429 | `RATE_LIMIT_EXCEEDED` |
| Upstream service error | 502 | `PRODUCT_SERVICE_UNAVAILABLE` |
| Unexpected failure | 500 | omit or `INTERNAL_ERROR` |

Every error response must include both `error` (human-readable) and `code`
(machine-readable) fields. The `code` field must never be omitted.

---

## OS-7. State machine

The canonical transition map lives in `order.repository.ts` as
`export const VALID_TRANSITIONS`. It is the **single source of truth** — import
it wherever transition logic is needed; never redeclare it.

```
PENDING_PAYMENT → PAID | CANCELLED
PAID            → PROCESSING | CANCELLED | REFUNDED
PROCESSING      → SHIPPED | CANCELLED
SHIPPED         → DELIVERED | CANCELLED
DELIVERED       → REFUNDED
CANCELLED       → (terminal)
REFUNDED        → (terminal)
```

The repository enforces the state machine on every write.
Handlers may read `VALID_TRANSITIONS` to produce detailed user-facing error
messages but must not enforce it independently.

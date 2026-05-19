# Admin Frontend Audit — `apps/admin`

> Audited: 2026-05-19  
> Stack: TanStack Start (React 19 + SSR) · TanStack Router v1 · TanStack Query v5 · Effect v3 · Vite 8 · Tailwind v4  
> Total findings: **22** (P0: 6 · P1: 9 · P2: 7)

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| P0 — Critical (production-breaking) | 6 | ✅ All fixed |
| P1 — High (functionality degraded)  | 9 | ✅ All fixed |
| P2 — Medium (quality/consistency)   | 7 | ✅ 7 fixed |

---

## P0 — Critical

### A-01 · `__root.tsx` — `<Scripts />` missing from authenticated layout → app never hydrates ✅ FIXED

**File:** `src/routes/__root.tsx`  
**Root cause:** `<Scripts />` was inside the now-commented-out old layout block. The current live layout never called `<Scripts />`. Without this tag TanStack Start never injects the client-side JS bundle — the app renders via SSR but stays completely static (no interactions, no Query re-fetches, no React hydration).

**Fix applied:** Added `<Scripts />` before `</body>` in the authenticated layout and in the new login-path HTML shell.

---

### A-02 · `__root.tsx` — Login path renders bare `<div>` without HTML document structure ✅ FIXED

**File:** `src/routes/__root.tsx`  
**Root cause:** When `pathname.startsWith("/login")`, `RootDocument` returned a bare `<div>` — no `<html>`, `<head>`, `<HeadContent />`, `<body>`, or `<Scripts />`. With TanStack Start's SSR this produces invalid HTML and the client bundle is never loaded for the login page.

**Fix applied:** Both branches of `RootDocument` now emit a complete HTML shell with `<HeadContent />` and `<Scripts />`.

---

### A-03 · `package.json` — `sonner` not listed as a dependency ✅ FIXED

**Root cause:** `sonner` was imported in `router.tsx`, `__root.tsx`, `lib/toast.ts` but absent from `package.json`. Worked only via pnpm hoisting from a sibling workspace package — breaks on clean installs and deployments.

**Fix applied:** Added `"sonner": "^1.7.0"` to `dependencies`.

---

### A-04 · `package.json` — `lucide-react` not listed as a dependency ✅ FIXED

**Root cause:** `EyeIcon`, `EyeOffIcon` from `lucide-react` used in `-login-page.tsx` but absent from `package.json`.

**Fix applied:** Added `"lucide-react": "^0.475.0"` to `dependencies`.

---

### A-05 · `DataTable` — Pagination completely broken with `manualPagination` ✅ FIXED

**File:** `src/components/data-table/data-table.tsx`  
**Root cause:** Component set `manualPagination: true` (correct) but used `table.previousPage()` / `table.nextPage()` / `table.getCanPreviousPage()` / `table.getCanNextPage()` — all of which operate on TanStack Table's *internal* cursor. With `manualPagination: true`, the internal cursor never advances so buttons were perpetually disabled and `onPageChange` was never called.

**Affected pages:** Products, Orders, Customers, Audit Logs.

**Fix applied:** Replaced TanStack Table-internal calls with prop-driven logic:
- `onClick={() => onPageChange(page - 1)}` / `disabled={page <= 1}`
- `onClick={() => onPageChange(page + 1)}` / `disabled={page >= totalPages}`
- Also removed unused `getPaginationRowModel` import.

---

### A-06 · `products.new.tsx` — Optimistic update uses wrong query key shape ✅ FIXED

**File:** `src/routes/products.new.tsx`  
**Root cause:** `onMutate` used `["products", 1, ""]` (flat array) but `-products-page.tsx` uses `["products", { page, search }]` (object literal). The cache lookup always returned `undefined`, so no optimistic row was added and rollback was also broken.

**Fix applied:** Changed cache key to `["products", { page: 1, search: "" }]` to match the actual query key. Also stored `cacheKey` in `onMutate` context so `onError` rollback uses the same key.

---

## P1 — High

### A-07 · `__root.tsx` — Devtools never render (commented out) ✅ FIXED

**Fix applied:** `TanStackRouterDevtools` and `ReactQueryDevtools` are now rendered inside `{import.meta.env.DEV && ...}` block after `</SidebarProvider>` in the authenticated layout.

---

### A-08 · `__root.tsx` — `throw redirect({ to: "/login" as any })` — unsafe `as any` cast ✅ FIXED

**Fix applied:** Removed `as any` from the root redirect. Same fix applied to `products.new.tsx` and `products.$productId.tsx` (A-17).

---

### A-09 · `__root.tsx` — Stale unused imports: `Sidebar` and `Topbar` ✅ FIXED

**Fix applied:** Removed `Sidebar` and `Topbar` from the import — only `ErrorBoundary` is kept from the components barrel.

---

### A-10 · `__root.tsx` — Large commented-out block is dead code ✅ FIXED

**Fix applied:** The entire old layout block (lines 158–185 in the original) was deleted in the `__root.tsx` rewrite.

---

### A-11 · `server/products.ts` — Unreachable null check inside Effect pipeline ✅ FIXED

**File:** `src/server/products.ts` (`getProductFn`)  
**Root cause:** `if (!product)` after `yield* api.products.getOne(data.id)` can never be reached — on a 404 the backend's `request()` helper throws `ApiError{ status: 404 }` before `product` is ever assigned.

**Fix applied:** Removed the dead null check and the now-unused `NotFoundError` import.

---

### A-12 · `orders.$orderId.tsx` — Update Status form uses raw HTML `<select>` / `<textarea>` ✅ FIXED

**Fix applied:** `<textarea>` replaced with `<Textarea>` from `@repo/ui/components/textarea`. Select wrapped in `<Field>` / `<FieldLabel>` / `<FieldError>` with design-system consistent border/bg styling (`border-input bg-background`). Note: a native `<select>` is retained until a `@repo/ui` Select component with option rendering is available.

---

### A-13 · `-orders-page.tsx` — Status filter `<select>` has hardcoded `bg-white` ✅ FIXED

**Fix applied:** Replaced `bg-white` with `bg-background border-input` — adapts correctly to dark mode via CSS variables.

---

### A-14 · Cookie names incorrectly `encodeURIComponent`-encoded ✅ FIXED

**Files:** `src/server/auth.ts`, `src/effect/AuditMiddleware.ts`  
**Root cause:** RFC 6265 prohibits URI-encoding of cookie names. Only the value requires escaping.

**Fix applied:** Changed `${encodeURIComponent(k)}=...` → `${k}=...` in both files. Cookie values remain correctly encoded.

---

### A-15 · `components/index.ts` — Barrel exports stale `Sidebar` and `Topbar` ✅ FIXED

**Fix applied:** Removed `Sidebar` and `Topbar` exports from the components barrel. The layout now uses `AppSidebar` and `SiteHeader` directly.

---

## P2 — Medium

### A-16 · `audit-logs` route — Page not persisted in URL ✅ FIXED

**Fix applied:** Added `validateSearch` / `loaderDeps` to `audit-logs.route.tsx`. The page component now reads `page` from `Route.useSearch()` and navigates via `useNavigate` — same pattern as products/orders/customers.

---

### A-17 · `products.new.tsx` + `products.$productId.tsx` — `redirect({ to: "..." as any })` ✅ FIXED

**Fix applied:** See A-08 — all three `as any` redirect casts removed together.

---

### A-18 · `-customers-page.tsx` — Search input is uncontrolled (`defaultValue`) ✅ FIXED

**Fix applied:** Added `const [inputValue, setInputValue] = useState(search)` local state. `handleSearch` now updates `inputValue` immediately (instant feedback) before the debounced URL update. Input is now controlled with `value={inputValue}`.

---

### A-19 · `products.new.tsx` — `description: ""` sent to API instead of `undefined` ✅ FIXED

**Fix applied:** The `onSubmit` callback in `NewProductPage` now maps empty description to `undefined`:
```tsx
description: data.description?.trim() || undefined
```

---

### A-20 · Context unsafe cast repeated across all protected routes ✅ FIXED

**Fix applied:** Introduced `RouterContext` interface (`src/lib/router-context.ts`) with `{ queryClient: QueryClient; session?: Session }`. Used in `createRootRouteWithContext<RouterContext>()` in `__root.tsx` so TypeScript propagates the correct context shape to all child routes. Removed all `as { session?: Session }` casts from `products.route.tsx`, `customers.route.tsx`, `orders.route.tsx`, `audit-logs.route.tsx`, `products.new.tsx`, `products.$productId.tsx`, and all `as { queryClient: QueryClient }` casts from `products.$productId.tsx`, `customers.$userId.tsx`, and `orders.$orderId.tsx`. Cleaned up now-unused `type Session` imports from each affected file. `RouterContext` exported from the `@/lib` barrel for future use.

---

### A-21 · `getSession()` has no caching — triggers `/auth/me` on every navigation ✅ FIXED

**Fix applied:** `beforeLoad` in `__root.tsx` now uses `queryClient.fetchQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 5 * 60 * 1_000 })` instead of calling `getSession()` directly. Within a 5-minute window, navigating between routes reuses the cached session without a network round-trip. After `silentRefresh()`, the cache entry is removed via `queryClient.removeQueries` and a fresh fetch is forced. Logout (via `queryClient.clear()`) and 401 handling (via `queryClient.invalidateQueries()`) in `router.tsx` already invalidate the session cache correctly.

---

### A-22 · `ServerContext.ts` — `runServerEffect` / `runServerEffectSafe` are unused ✅ FIXED

**Fix applied:** Confirmed zero call-site usages across the entire codebase. Deleted `src/effect/ServerContext.ts`, removed `export * from "./ServerContext"` from `effect/index.ts`, and updated the stale comment in `Middleware.ts` that referenced `runServerEffect`. All server function handlers continue to use `context.runtime.runPromise(...)` via `effectMiddleware` unchanged.

---

## Fix Summary

```
P0 — All 6 fixed ✅
  A-01  Added <Scripts /> to authenticated layout
  A-02  Fixed login path HTML structure (<html><head><body><Scripts />)
  A-03  Added sonner to package.json dependencies
  A-04  Added lucide-react to package.json dependencies
  A-05  Fixed DataTable pagination (prop-driven, not TanStack Table internal state)
  A-06  Fixed optimistic update query key in products.new.tsx

P1 — All 9 fixed ✅
  A-07  Restored devtools in live layout (DEV guard)
  A-08  Removed `as any` in root redirect
  A-09  Removed unused Sidebar/Topbar imports in __root.tsx
  A-10  Deleted commented-out old layout block
  A-11  Removed unreachable null check in getProductFn + stale import
  A-12  Replaced raw <textarea> with @repo/ui Textarea in order detail form
  A-13  Fixed hardcoded bg-white → bg-background in orders status filter
  A-14  Fixed encodeURIComponent on cookie names (auth.ts + AuditMiddleware.ts)
  A-15  Removed stale Sidebar/Topbar from components barrel

P2 — All 7 fixed ✅
  A-16  ✅ Persisted audit-logs page in URL (validateSearch + loaderDeps)
  A-17  ✅ Removed remaining `as any` redirects in products.new + products.$productId
  A-18  ✅ Fixed uncontrolled search input in customers page
  A-19  ✅ Mapped empty description to undefined before API call
  A-20  ✅ RouterContext interface — eliminated all unsafe context casts (9 files)
  A-21  ✅ Cached session via queryClient.fetchQuery (staleTime 5 min)
  A-22  ✅ Deleted ServerContext.ts (runServerEffect / runServerEffectSafe unused)
```

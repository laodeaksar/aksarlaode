# apps/admin

Admin panel untuk MyEcommerce. Dibangun dengan **TanStack Start RC** (SSR + streaming) dan **Effect-TS v3** untuk data fetching yang type-safe di server.

---

## Stack

| Layer | Library |
|---|---|
| Framework | TanStack Start RC (`@tanstack/react-start`) + Vinxi |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Server functions | `createServerFn` — runs Effect.gen on the server |
| Data fetching / cache | TanStack Query v5 |
| Effect runtime | Effect-TS v3 (`ManagedRuntime`) |
| Validation | `Effect.Schema` (request + response) |
| Error model | `Data.TaggedError` — fully typed, no `any` |
| Styling | Tailwind CSS v3 + `@repo/ui` (shadcn/ui) |
| Type checking | TypeScript 5 strict mode |

---

## Cara menjalankan

```bash
# Dari root monorepo — dev semua apps sekaligus:
pnpm dev

# Atau hanya admin:
pnpm --filter admin dev
```

Dev server berjalan di `http://localhost:4322`.

### Build & start production

```bash
pnpm --filter admin build   # output → .output/
pnpm --filter admin start   # node .output/server/index.mjs
```

---

## Struktur folder

```
apps/admin/
├── app.config.ts           # TanStack Start / Vinxi config (menggantikan vite.config.ts)
├── app/
│   ├── client.tsx          # Client hydration entry
│   ├── ssr.tsx             # SSR streaming handler (defaultStreamHandler)
│   └── router.tsx          # Router factory — dipanggil di server dan client
├── src/
│   ├── effect/             # Effect-TS layer
│   │   ├── Errors.ts       # Typed error model (Data.TaggedError)
│   │   ├── Services.ts     # ConfigService + ApiClientService (Effect.Service)
│   │   ├── Runtime.ts      # AppLayer + AppRuntime (ManagedRuntime)
│   │   ├── ServerContext.ts# runServerEffect / runServerEffectSafe helpers
│   │   └── index.ts        # Barrel export
│   ├── server/             # TanStack Start server functions
│   │   └── products.ts     # listProductsFn, getProductFn, createProductFn, …
│   ├── routes/             # File-based routes (TanStack Router)
│   │   ├── __root.tsx      # HTML document shell + auth guard + admin layout
│   │   ├── products/
│   │   │   ├── index.tsx        # GET loader → listProductsFn
│   │   │   ├── products-page.tsx# ProductsPage + optimistic delete
│   │   │   ├── new.tsx          # POST mutation → createProductFn + optimistic add
│   │   │   └── $productId.tsx   # SSR loader + optimistic update
│   │   └── …
│   ├── components/
│   ├── lib/                # api.ts (browser client), auth.ts, rbac.ts, …
│   └── types/
└── README.md
```

---

## Cara kerja SSR + server functions

```
Browser GET /products
       │
       ▼
  Vinxi (SSR)
       │  calls loader()
       ▼
  listProductsFn  ←── createServerFn({ method: "GET" })
       │
       ▼
  Effect.gen → ApiClientService → fetch /products (internal)
       │
       ▼
  React renderToPipeableStream → streaming HTML
       │
       ▼
  hydrateRoot (client.tsx) → React Query seeded from loader data
```

Pada navigasi client-side berikutnya, TanStack Start otomatis memanggil server function via HTTP endpoint internal — tidak ada fetch logic di client bundle.

---

## Cara menambah service baru

### 1. Tambah method di `ApiClientService` (src/effect/Services.ts)

```typescript
// Dalam object return ApiClientService.effect:
const payments = {
  list: (params: { page?: number }) =>
    request<{ items: Payment[]; total: number }>(
      `/payments?page=${params.page ?? 1}`
    ),
}
return { products, orders, customers, dashboard, auditLogs, payments }
```

### 2. Buat server function (src/server/payments.ts)

```typescript
import { createServerFn } from "@tanstack/react-start"
import { Effect, Schema }  from "effect"
import { ApiClientService } from "@/effect/Services"
import { runServerEffect }  from "@/effect/ServerContext"

export const listPaymentsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => raw as { page?: number })
  .handler(async ({ data }) =>
    runServerEffect(
      Effect.gen(function* () {
        const api = yield* ApiClientService
        return yield* api.payments.list(data)
      }),
    )
  )
```

### 3. Gunakan di route (src/routes/payments/index.tsx)

```typescript
export const Route = createFileRoute("/payments/")({
  loader: () => listPaymentsFn({ data: { page: 1 } }),
  component: lazy(() => import("./payments-page")),
})
```

---

## Cara menambah error type baru

Di `src/effect/Errors.ts`:

```typescript
export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly retryAfterMs: number
}> {
  get userMessage() {
    return `Terlalu banyak permintaan. Coba lagi dalam ${this.retryAfterMs / 1000} detik.`
  }
}

// Tambahkan ke union:
export type AppError =
  | ApiError | NetworkError | ValidationError
  | NotFoundError | UnauthorizedError | RateLimitError
```

---

## Checklist

- [x] SSR berjalan — loader dieksekusi di server, HTML di-stream ke browser
- [x] Hydration OK — React Query seeded dari `Route.useLoaderData()` tanpa fetch ulang
- [x] Error handling typed — `Data.TaggedError` exhaustive, tidak ada `any` / `unknown` bocor
- [x] Server functions terisolasi — Effect runtime tidak masuk client bundle
- [x] Optimistic update — delete dan create dengan rollback otomatis
- [x] Monorepo compat — path alias `@/`, workspace packages, turbo.json tetap jalan
- [x] Auth guard SSR — `beforeLoad` di `__root.tsx` cek session sebelum render
- [x] RBAC tetap jalan — `can()` dan `hasAnyAdminRole()` tidak berubah

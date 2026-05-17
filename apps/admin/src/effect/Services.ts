import { Effect, Schema } from "effect"
import {
  ApiError,
  NetworkError,
} from "./Errors"

// ── Inline types (mirrors @repo/common to avoid cross-package resolution) ─
// These stay in sync with packages/common/src/schemas.
// If the shared schemas diverge, update these types accordingly.

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED"

export type Product = {
  id:          string
  name:        string
  price:       number
  stock:       number
  sku:         string
  status:      ProductStatus
  description: string | undefined
  imageUrls:   string[] | undefined
  createdAt:   string | undefined
  updatedAt:   string | undefined
}

export type NewProduct = {
  name:         string
  price:        number
  stock:        number
  sku:          string
  description?: string
  imageUrls?:   string[]
  status?:      ProductStatus
}

export type User = {
  id:        string
  name:      string
  email:     string
  role:      string
  createdAt: string | undefined
}

// ── Re-exported types from api.ts (used across the app) ───────────────────
export type {
  OrderSummary,
  OrderDetail,
  DashboardStats,
  AuditLogEntry,
} from "@/lib/api"

// ── ConfigService ─────────────────────────────────────────────────────────
// Reads env vars once at runtime init. Server-only — never bundled to client.
// `process.env` is available in TanStack Start server functions.

export class ConfigService extends Effect.Service<ConfigService>()("admin/ConfigService", {
  effect: Effect.sync(() => ({
    apiUrl:        process.env["PUBLIC_API_URL"] ?? "http://localhost:3000",
    adminUrl:      process.env["ADMIN_URL"]      ?? "http://localhost:4322",
    internalToken: process.env["INTERNAL_SERVICE_TOKEN"] ?? "",
  } as const)),
}) {}

// ── Effect.Schema — request / response validation ─────────────────────────

export const ProductSchema = Schema.Struct({
  id:          Schema.String,
  name:        Schema.String,
  price:       Schema.Number,
  stock:       Schema.Number,
  sku:         Schema.String,
  status:      Schema.Literal("ACTIVE", "DRAFT", "ARCHIVED"),
  description: Schema.optional(Schema.String),
  imageUrls:   Schema.optional(Schema.Array(Schema.String)),
  createdAt:   Schema.optional(Schema.String),
  updatedAt:   Schema.optional(Schema.String),
})
export type ProductDecoded = Schema.Schema.Type<typeof ProductSchema>

export const ProductListSchema = Schema.Struct({
  items: Schema.Array(ProductSchema),
  total: Schema.Number,
})

export const NewProductSchema = Schema.Struct({
  name:        Schema.String.pipe(Schema.minLength(1)),
  price:       Schema.Number.pipe(Schema.filter((n) => n > 0, { message: () => "price must be positive" })),
  stock:       Schema.Number.pipe(Schema.filter((n) => n >= 0, { message: () => "stock must be non-negative" })),
  sku:         Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  imageUrls:   Schema.optional(Schema.Array(Schema.String)),
  status:      Schema.optional(Schema.Literal("ACTIVE", "DRAFT", "ARCHIVED")),
})
export type NewProductInput = Schema.Schema.Type<typeof NewProductSchema>

export const UpdateProductSchema = Schema.partial(NewProductSchema)
export type UpdateProductInput = Schema.Schema.Type<typeof UpdateProductSchema>

// ── ApiClientService ───────────────────────────────────────────────────────
// A typed Effect-based HTTP client. Used ONLY in server functions.
// The browser client (src/lib/api.ts) remains for legacy client-side fetches.

import type {
  OrderSummary,
  OrderDetail,
  DashboardStats,
  AuditLogEntry,
} from "@/lib/api"

export class ApiClientService extends Effect.Service<ApiClientService>()("admin/ApiClientService", {
  effect: Effect.gen(function* () {
    const config = yield* ConfigService

    // ── Core request helper ─────────────────────────────────────────────
    function request<T>(
      path: string,
      init: RequestInit = {},
    ): Effect.Effect<T, ApiError | NetworkError> {
      return Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${config.apiUrl}${path}`, {
            ...init,
            headers: {
              "Content-Type": "application/json",
              ...(config.internalToken
                ? { "x-service-token": config.internalToken }
                : {}),
              ...(init.headers ?? {}),
            },
          })

          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }))
            throw new ApiError({
              status:  res.status,
              message: (body as { error?: string }).error ?? res.statusText,
              path,
            })
          }

          return res.json() as Promise<T>
        },
        catch: (e) =>
          e instanceof ApiError ? e : new NetworkError({ cause: e, path }),
      })
    }

    // ── Products ────────────────────────────────────────────────────────
    const products = {
      list: (params: { page?: number; limit?: number; search?: string }) => {
        const qs = new URLSearchParams({
          page:   String(params.page  ?? 1),
          limit:  String(params.limit ?? 20),
          ...(params.search ? { search: params.search } : {}),
        }).toString()
        return request<{ items: Product[]; total: number }>(`/products?${qs}`)
      },

      getOne: (id: string) =>
        request<Product>(`/products/${id}`),

      create: (body: NewProduct) =>
        request<Product>("/products", {
          method: "POST",
          body:   JSON.stringify(body),
        }),

      update: (id: string, body: Partial<NewProduct>) =>
        request<Product>(`/products/${id}`, {
          method: "PUT",
          body:   JSON.stringify(body),
        }),

      delete: (id: string) =>
        request<void>(`/products/${id}`, { method: "DELETE" }),
    }

    // ── Orders ──────────────────────────────────────────────────────────
    const orders = {
      list: (params: { page?: number; status?: string }) => {
        const qs = new URLSearchParams({
          page: String(params.page ?? 1),
          ...(params.status ? { status: params.status } : {}),
        }).toString()
        return request<{ items: OrderSummary[]; total: number }>(`/orders?${qs}`)
      },

      getOne: (id: string) =>
        request<OrderDetail>(`/orders/${id}`),

      updateStatus: (id: string, status: string, note?: string) =>
        request<void>(`/orders/${id}/status`, {
          method: "PATCH",
          body:   JSON.stringify({ status, note }),
        }),
    }

    // ── Customers ────────────────────────────────────────────────────────
    const customers = {
      list: (params: { page?: number; search?: string }) => {
        const qs = new URLSearchParams({ page: String(params.page ?? 1) }).toString()
        return request<{ items: User[]; total: number }>(`/admin/customers?${qs}`)
      },

      getOne: (id: string) =>
        request<User>(`/admin/customers/${id}`),
    }

    // ── Dashboard ────────────────────────────────────────────────────────
    const dashboard = {
      stats: () => request<DashboardStats>("/admin/dashboard/stats"),
    }

    // ── Audit logs ────────────────────────────────────────────────────────
    const auditLogs = {
      list: (page = 1) =>
        request<{ items: AuditLogEntry[]; total: number; page: number; limit: number }>(
          `/products/audit-logs?page=${page}`
        ),
    }

    return { products, orders, customers, dashboard, auditLogs } as const
  }),
}) {}

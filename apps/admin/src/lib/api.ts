// ── lib/api.ts — LAYER-02 cleanup ─────────────────────────────────────────
//
// Scope post-LAYER-02: SOLO auth (login / logout / silent-refresh).
// Tutte le altre API sono migrate a server functions in src/server/*.ts che
// usano ApiClientService (Effect layer) con service-to-service token.
//
// Regola definitiva (da admin-consistency.md):
//   login / logout / refresh  → qui (window.location + cookie handling)
//   semua data lainnya        → src/server/*.ts (Effect server function)
//
// TODO(TYPE-04): i 4 type di risposta (OrderSummary, OrderDetail,
// DashboardStats, AuditLogEntry) vengono ancora re-esportati da
// Services.schemas.ts → lib/api.ts. Spostare le definizioni in @repo/common
// o src/types/ per eliminare questa dipendenza inversa.

import { env } from "@repo/env/admin"

type ApiResponse<T> = { data: T; error: null } | { data: null; error: string }

// FIX ADM-02: token refresh state — one in-flight refresh at a time.
// If multiple requests 401 simultaneously, only one refresh call is made;
// the others wait for the same promise.
let refreshPromise: Promise<boolean> | null = null

async function silentRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${env.PUBLIC_API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      return res.ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${env.PUBLIC_API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    // FIX ADM-02: intercept TOKEN_EXPIRED 401 — attempt a silent refresh once.
    // If the refresh succeeds, retry the original request automatically.
    // If the refresh fails (e.g. refresh token also expired), redirect to login.
    if (res.status === 401 && !isRetry) {
      let errorCode = ""
      try {
        const body = await res.clone().json()
        errorCode = body?.code ?? ""
      } catch {
        /* ignore parse errors */
      }

      if (errorCode === "TOKEN_EXPIRED" || errorCode === "UNAUTHORIZED") {
        const refreshed = await silentRefresh()

        if (refreshed) {
          return request<T>(path, options, true)
        }

        window.location.href = "/login"
        return { data: null, error: "Session expired" }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      return { data: null, error: err.error ?? "Request failed" }
    }

    const data = (await res.json()) as T
    return { data, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────
// login + logout pakai client-side fetch karena butuh cookie credentials dan
// window.location redirect — tidak bisa dijalankan di server function.
export const authApi = {
  login: (body: { email: string; password: string }) =>
    request<{
      accessToken: string
      user: { id: string; email: string; name: string; role: string }
    }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),
}

// ── Response types ─────────────────────────────────────────────────────────
// TODO(TYPE-04): pindahkan ke @repo/common atau src/types/ agar
// Services.schemas.ts tidak lagi bergantung pada layer client ini.

export type AuditLogEntry = {
  id: string
  actorId: string
  actorRole: string
  action: string
  resource: string
  resourceId: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type DashboardStats = {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  totalProducts: number
  revenueToday: number
  ordersToday: number
  recentOrders: OrderSummary[]
  topProducts: Array<{ id: string; name: string; salesCount: number }>
}

export type OrderSummary = {
  orderId: string
  userId: string
  status: string
  grandTotal: number
  createdAt: string
}

export type OrderDetail = OrderSummary & {
  items: Array<{
    productId: string
    productName: string
    quantity: number
    price: number
    subtotal: number
  }>
  shippingAddress: Record<string, string>
  statusHistory: Array<{ status: string; note?: string; timestamp: string }>
}

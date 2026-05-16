import { env }   from "@repo/env"
import type {
  Product, NewProduct,
  Payment,
  User
} from "@repo/common"

type ApiResponse<T> =
  | { data: T;    error: null  }
  | { data: null; error: string }

// FIX ADM-02: token refresh state — one in-flight refresh at a time.
// If multiple requests 401 simultaneously, only one refresh call is made;
// the others wait for the same promise.
let refreshPromise: Promise<boolean> | null = null

async function silentRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${env.PUBLIC_API_URL}/auth/refresh`, {
        method:      "POST",
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
  path:    string,
  options: RequestInit = {},
  isRetry  = false,
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
        errorCode  = body?.code ?? ""
      } catch { /* ignore parse errors */ }

      if (errorCode === "TOKEN_EXPIRED" || errorCode === "UNAUTHORIZED") {
        const refreshed = await silentRefresh()

        if (refreshed) {
          // Retry the original request with the new access token in the cookie
          return request<T>(path, options, true)
        }

        // Refresh failed — session is dead, redirect to login
        window.location.href = "/login"
        return { data: null, error: "Session expired" }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      return { data: null, error: err.error ?? "Request failed" }
    }

    const data = await res.json() as T
    return { data, error: null }

  } catch (e) {
    return { data: null, error: String(e) }
  }
}

// ── Products ──────────────────────────────────────────────
export const productsApi = {
  list:   (params?: string)       => request<{ items: Product[]; total: number }>(`/products?${params ?? ""}`),
  getOne: (id: string)            => request<Product>(`/products/${id}`),
  create: (body: NewProduct)      => request<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<NewProduct>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string)            => request<void>(`/products/${id}`, { method: "DELETE" }),
}

// ── Orders ────────────────────────────────────────────────
export const ordersApi = {
  list:         (params?: string)                    => request<{ items: OrderSummary[]; total: number }>(`/orders?${params ?? ""}`),
  getOne:       (id: string)                         => request<OrderDetail>(`/orders/${id}`),
  updateStatus: (id: string, status: string, note?: string) =>
    request<void>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
}

// ── Customers ─────────────────────────────────────────────
export const customersApi = {
  list:   (params?: string) => request<{ items: User[]; total: number }>(`/admin/customers?${params ?? ""}`),
  getOne: (id: string)      => request<User>(`/admin/customers/${id}`),
}

// ── Dashboard ─────────────────────────────────────────────
export const dashboardApi = {
  stats: () => request<DashboardStats>("/admin/dashboard/stats"),
}

// ── Types ─────────────────────────────────────────────────
export type DashboardStats = {
  totalRevenue:   number
  totalOrders:    number
  totalCustomers: number
  totalProducts:  number
  revenueToday:   number
  ordersToday:    number
  recentOrders:   OrderSummary[]
  topProducts:    Array<{ id: string; name: string; salesCount: number }>
}

export type OrderSummary = {
  orderId:     string
  userId:      string
  status:      string
  grandTotal:  number
  createdAt:   string
}

export type OrderDetail = OrderSummary & {
  items:           Array<{ productId: string; productName: string; quantity: number; price: number; subtotal: number }>
  shippingAddress: Record<string, string>
  statusHistory:   Array<{ status: string; note?: string; timestamp: string }>
}

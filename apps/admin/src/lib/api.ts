import { env }   from "@repo/env"
import type {
  Product, NewProduct,
  Payment,
  User
} from "@repo/common"

type ApiResponse<T> =
  | { data: T;    error: null  }
  | { data: null; error: string }

async function request<T>(
  path:    string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${env.PUBLIC_API_URL}${path}`, {
      ...options,
      credentials: "include",              // sends httpOnly cookie
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

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

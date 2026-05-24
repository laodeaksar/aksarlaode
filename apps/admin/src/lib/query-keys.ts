// src/lib/query-keys.ts — canonical TanStack Query key registry
//
// Rule: NEVER hardcode query keys as raw strings in components or routes.
// Always import from here.  This prevents typos and makes bulk
// invalidations / key shape changes a single-file edit.
//
// Usage:
//   import { queryKeys } from "@/lib"
//   useQuery({ queryKey: queryKeys.products.list({ page: 1 }) })
//   queryClient.invalidateQueries({ queryKey: queryKeys.products.all })

export const queryKeys = {
  // ── Auth ────────────────────────────────────────────────────────────────
  session: ["session"] as const,

  // ── Dashboard ────────────────────────────────────────────────────────────
  dashboard: {
    stats: ["dashboard-stats"] as const,
  },

  // ── Products ─────────────────────────────────────────────────────────────
  products: {
    all: ["products"] as const,
    list: (params: { page: number; search?: string; limit?: number }) =>
      ["products", params] as const,
    detail: (id: string) => ["product", id] as const,
    search: (query: string) => ["products-search", query] as const,
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  orders: {
    all: ["orders"] as const,
    list: (params: { page: number; status?: string; search?: string }) =>
      ["orders", params] as const,
    detail: (id: string) => ["order", id] as const,
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  customers: {
    all: ["customers"] as const,
    list: (params: { page: number; search?: string }) =>
      ["customers", params] as const,
    detail: (id: string) => ["customer", id] as const,
  },

  // ── Admin users ───────────────────────────────────────────────────────────
  adminUsers: {
    all: ["admin-users"] as const,
    list: (params: { page: number; search?: string }) =>
      ["admin-users", params] as const,
  },

  // ── Audit logs ────────────────────────────────────────────────────────────
  auditLogs: {
    list: (params: {
      page: number;
      startDate?: string;
      endDate?: string;
      action?: string;
      actorRole?: string;
    }) => ["audit-logs", params] as const,
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: ["settings"] as const,
  storeSettings: ["store-settings"] as const,

  // ── Queue ─────────────────────────────────────────────────────────────────
  queue: {
    stats: ["queue-stats"] as const,
    failedJobs: ["queue-failed-jobs"] as const,
    liveJobs: ["queue-live-jobs"] as const,
    typeStats: ["queue-type-stats"] as const,
    activity: ["queue-activity"] as const,
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    newOrders: ["new-orders-count"] as const,
  },
} as const;

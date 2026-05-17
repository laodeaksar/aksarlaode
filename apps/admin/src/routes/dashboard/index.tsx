import type { DashboardStats, OrderSummary } from "@/effect/Services"
import { getDashboardStatsFn } from "@/server/dashboard"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui"

export const Route = createFileRoute("/dashboard/")({
  // SSR loader: stats are fetched server-side on first load.
  // useQuery below seeds from loaderData so the skeleton never shows on SSR.
  loader: () => getDashboardStatsFn({}),

  component: DashboardPage,
})

function DashboardPage() {
  const loaderData = Route.useLoaderData()

  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStatsFn({}),
    // Seed from SSR — no skeleton flash on first load
    initialData: loaderData,
    // Keep dashboard live without a full page refresh
    refetchInterval: 30_000,
  })

  // `initialData` guarantees `data` is always defined here
  const stats: DashboardStats = data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Revenue (Today)"
          value={`Rp ${stats.revenueToday.toLocaleString("id-ID")}`}
        />
        <StatCard title="Orders (Today)" value={stats.ordersToday} />
        <StatCard title="Total Customers" value={stats.totalCustomers} />
        <StatCard title="Total Products" value={stats.totalProducts} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={stats.recentOrders} />
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProductsList items={stats.topProducts} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function RecentOrdersTable({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada pesanan terbaru.</p>
  }
  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div
          key={order.orderId}
          className="flex items-center justify-between text-sm"
        >
          <span className="font-mono text-xs text-gray-600">
            {order.orderId.slice(0, 12)}…
          </span>
          <span
            className={
              order.status === "CANCELLED"
                ? "font-medium text-red-600"
                : "font-medium text-green-700"
            }
          >
            Rp {order.grandTotal.toLocaleString("id-ID")}
          </span>
        </div>
      ))}
    </div>
  )
}

function TopProductsList({
  items,
}: {
  items: Array<{ id: string; name: string; salesCount: number }>
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada data produk.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-gray-700">
            {i + 1}. {item.name}
          </span>
          <span className="text-gray-500">{item.salesCount} terjual</span>
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  )
}

// Keep skeleton available for Suspense fallback in __root.tsx
export { DashboardSkeleton }

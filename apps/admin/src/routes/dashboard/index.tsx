import { createFileRoute }  from "@tanstack/react-router"
import { useQuery }         from "@tanstack/react-query"
import { dashboardApi }     from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui"

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
})

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn:  () => dashboardApi.stats(),
    refetchInterval: 30_000,    // live refresh every 30s
  })

  if (isLoading) return <DashboardSkeleton />
  if (!data?.data) return <p>Failed to load stats.</p>

  const stats = data.data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Revenue (Today)"  value={`Rp ${stats.revenueToday.toLocaleString("id-ID")}`} />
        <StatCard title="Orders (Today)"   value={stats.ordersToday}    />
        <StatCard title="Total Customers"  value={stats.totalCustomers} />
        <StatCard title="Total Products"   value={stats.totalProducts}  />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
          <CardContent>
            <RecentOrdersTable orders={stats.recentOrders} />
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader><CardTitle>Top Products</CardTitle></CardHeader>
          <CardContent>
            <TopProductsList items={stats.topProducts} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
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

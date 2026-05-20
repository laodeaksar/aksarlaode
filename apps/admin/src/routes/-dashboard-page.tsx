import { useQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { getDashboardStatsFn } from "@/server/dashboard";
import type { DashboardStats, OrderSummary } from "@/effect/Services";

import { Route } from "./dashboard.route";

export default function DashboardPage() {
  const loaderData = Route.useLoaderData();

  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStatsFn({}),
    initialData: loaderData,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const stats: DashboardStats = data;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

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
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={stats.recentOrders} />
          </CardContent>
        </Card>

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
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function RecentOrdersTable({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada pesanan terbaru.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div
          key={order.orderId}
          className="flex items-center justify-between text-sm"
        >
          <span className="font-mono text-xs text-muted-foreground">
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
  );
}

function TopProductsList({
  items,
}: {
  items: Array<{ id: string; name: string; salesCount: number }>;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Belum ada data produk.</p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-foreground">
            {i + 1}. {item.name}
          </span>
          <span className="text-muted-foreground">
            {item.salesCount} terjual
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

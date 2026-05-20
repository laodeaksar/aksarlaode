import { useQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { getDashboardStatsFn } from "@/server/dashboard";
import type { DashboardStats } from "@/effect/Services";
import {
  StatCard,
  RecentOrdersTable,
  TopProductsList,
  DashboardSkeleton,
} from "@/components/dashboard";

import { Route } from "./route";

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

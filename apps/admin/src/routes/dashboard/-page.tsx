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
import { PageHeader } from "@/components/layout/page-header";

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStatsFn({}),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  if (!data) return <DashboardSkeleton />;

  const stats: DashboardStats = data;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Dashboard" />

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

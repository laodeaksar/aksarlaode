import { useQuery } from "@tanstack/react-query";

import { listOrdersFn } from "@/server/orders";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import {
  ExportOrdersButton,
  ORDER_STATUSES,
  orderColumns,
} from "@/components/orders";
import { useFilteredNavigation, useRouteSearch } from "@/lib";

import { Route } from "./route";

export default function OrdersPage() {
  // Per-field subscriptions: re-renders only when that specific param changes.
  const page   = useRouteSearch(Route, (s) => s.page);
  const status = useRouteSearch(Route, (s) => s.status);

  const currentPage = page ?? 1;

  const { setFilter, goToPage } = useFilteredNavigation("/orders");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", { page: currentPage, status }],
    queryFn: () =>
      listOrdersFn({
        data: { page: currentPage, ...(status ? { status } : {}) },
      }),
  });

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Orders" />

      <div className="flex items-center justify-between gap-3">
        <select
          className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm shadow-xs focus:ring-2 focus:outline-none"
          value={status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <ExportOrdersButton />
      </div>

      <DataTable
        columns={orderColumns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={currentPage}
        onPageChange={goToPage}
      />
    </div>
  );
}

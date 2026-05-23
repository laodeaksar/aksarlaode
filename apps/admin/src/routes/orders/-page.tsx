import { useQuery } from "@tanstack/react-query";
import { ShoppingCartIcon } from "lucide-react";

import { listOrdersFn } from "@/server/orders";
import { DataTable, PaginationBar } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/shared";
import {
  ExportOrdersButton,
  ORDER_STATUSES,
  orderColumns,
} from "@/components/orders";
import { useFilteredNavigation, useRouteSearch } from "@/lib";

import { Route } from "./route";

export default function OrdersPage() {
  const page = useRouteSearch(Route, (s) => s.page);
  const status = useRouteSearch(Route, (s) => s.status);

  const currentPage = page ?? 1;

  const { setFilter } = useFilteredNavigation("/orders");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", { page: currentPage, status }],
    queryFn: () =>
      listOrdersFn({
        data: { page: currentPage, ...(status ? { status } : {}) },
      }),
  });

  const emptyState = (
    <ModuleEmptyState
      icon={<ShoppingCartIcon />}
      title={
        status ? "Tidak ada pesanan dengan status ini" : "Belum ada pesanan"
      }
      description={
        status
          ? `Tidak ada pesanan dengan status "${status.replace(/_/g, " ")}". Coba filter lain.`
          : "Pesanan dari pelanggan akan muncul di sini."
      }
    />
  );

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

      <div className="space-y-3">
        <DataTable
          columns={orderColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
          virtualize
          containerHeight="640px"
          ariaLabel="Daftar pesanan"
          emptyState={emptyState}
        />
        <PaginationBar route={Route} to="/orders" total={data?.total ?? 0} />
      </div>
    </div>
  );
}

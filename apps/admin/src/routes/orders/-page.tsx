import { useCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { listOrdersFn } from "@/server/orders";
import { orderColumns, ORDER_STATUSES } from "@/components/orders";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";

import { Route } from "./route";

export default function OrdersPage() {
  const navigate = useNavigate();
  const { page, status } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["orders", { page, status }],
    queryFn: () =>
      listOrdersFn({
        data: { page, ...(status ? { status } : {}) },
      }),
  });

  const handleStatusChange = useCallback(
    (value: string) => {
      navigate({
        to: "/orders",
        search: (prev) => ({ ...prev, status: value, page: 1 }),
      });
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/orders",
        search: (prev) => ({ ...prev, page: newPage }),
      });
    },
    [navigate]
  );

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Orders" />

      <div className="flex items-center gap-3">
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={orderColumns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

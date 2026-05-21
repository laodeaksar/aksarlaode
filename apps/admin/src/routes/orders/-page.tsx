import { useCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { listOrdersFn } from "@/server/orders";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import {
  ExportOrdersButton,
  ORDER_STATUSES,
  orderColumns,
} from "@/components/orders";

import { Route } from "./route";

export default function OrdersPage() {
  const navigate = useNavigate();
  const { page, status } = Route.useSearch();
  const currentPage = page ?? 1;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", { page: currentPage, status }],
    queryFn: () =>
      listOrdersFn({
        data: { page: currentPage, ...(status ? { status } : {}) },
      }),
  });

  const handleStatusChange = useCallback(
    (value: string) => {
      navigate({
        to: "/orders",
        search: (prev) => ({ ...prev, status: value || undefined, page: 1 }),
      });
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/orders",
        search: (prev) => ({ ...prev, page: newPage > 1 ? newPage : undefined }),
      });
    },
    [navigate]
  );

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title="Orders" />

      <div className="flex items-center justify-between gap-3">
        <select
          className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm shadow-xs focus:ring-2 focus:outline-none"
          value={status ?? ""}
          onChange={(e) => handleStatusChange(e.target.value || "")}
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
        onPageChange={handlePageChange}
      />
    </div>
  );
}

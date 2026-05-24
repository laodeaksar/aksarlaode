import { useQuery } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";

import { listCustomersFn } from "@/server/customers";
import { customerColumns } from "@/components/customers";
import { DataTable, PaginationBar } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState, SearchInput } from "@/components/shared";
import {
  queryKeys,
  useDebouncedInput,
  useFilteredNavigation,
  useRouteSearch,
} from "@/lib";

import { Route } from "./route";

export default function CustomersPage() {
  const page = useRouteSearch(Route, (s) => s.page);
  const search = useRouteSearch(Route, (s) => s.search);

  const currentPage = page ?? 1;

  const { setFilter } = useFilteredNavigation("/customers");
  const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.customers.list({ page: currentPage, search }),
    queryFn: () =>
      listCustomersFn({
        data: { page: currentPage, ...(search ? { search } : {}) },
      }),
  });

  const emptyState = (
    <ModuleEmptyState
      icon={<UsersIcon />}
      title={search ? "Pelanggan tidak ditemukan" : "Belum ada pelanggan"}
      description={
        search
          ? `Tidak ada pelanggan yang cocok dengan "${search}". Coba kata kunci lain.`
          : "Pelanggan yang mendaftar di toko akan muncul di sini."
      }
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" />

      <SearchInput placeholder="Search by name or email..." {...searchInput} />

      <div className="space-y-3">
        <DataTable
          columns={customerColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyState={emptyState}
        />
        <PaginationBar route={Route} to="/customers" total={data?.total ?? 0} />
      </div>
    </div>
  );
}

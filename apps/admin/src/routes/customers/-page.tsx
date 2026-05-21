import { useQuery } from "@tanstack/react-query";

import { listCustomersFn } from "@/server/customers";
import { customerColumns } from "@/components/customers";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared";
import { useDebouncedInput, useFilteredNavigation, useRouteSearch } from "@/lib";

import { Route } from "./route";

export default function CustomersPage() {
  // Per-field subscriptions: re-renders only when that specific param changes.
  const page   = useRouteSearch(Route, (s) => s.page);
  const search = useRouteSearch(Route, (s) => s.search);

  const currentPage = page ?? 1;

  const { setFilter, goToPage } = useFilteredNavigation("/customers");
  const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));

  const { data, isLoading } = useQuery({
    queryKey: ["customers", { page: currentPage, search }],
    queryFn: () =>
      listCustomersFn({
        data: { page: currentPage, ...(search ? { search } : {}) },
      }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" />

      <SearchInput placeholder="Search by name or email..." {...searchInput} />

      <DataTable
        columns={customerColumns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={currentPage}
        onPageChange={goToPage}
      />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";

import { listCustomersFn } from "@/server/customers";
import { customerColumns } from "@/components/customers";
import { DataTable, PaginationBar } from "@/components/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/shared";
import { useDebouncedInput, useFilteredNavigation, useRouteSearch } from "@/lib";

import { Route } from "./route";

export default function CustomersPage() {
  const page   = useRouteSearch(Route, (s) => s.page);
  const search = useRouteSearch(Route, (s) => s.search);

  const currentPage = page ?? 1;

  const { setFilter } = useFilteredNavigation("/customers");
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

      <div className="space-y-3">
        <DataTable
          columns={customerColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
        />
        <PaginationBar route={Route} to="/customers" total={data?.total ?? 0} />
      </div>
    </div>
  );
}

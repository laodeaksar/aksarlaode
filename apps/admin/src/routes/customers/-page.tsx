import { useQuery } from "@tanstack/react-query";

import { Input } from "@repo/ui/components/input";

import { listCustomersFn } from "@/server/customers";
import { customerColumns } from "@/components/customers";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { useDebouncedInput, useFilteredNavigation } from "@/lib";

import { Route } from "./route";

export default function CustomersPage() {
  const { page, search } = Route.useSearch();
  const currentPage = page ?? 1;

  const { setFilter, goToPage } = useFilteredNavigation("/customers");
  const [searchValue, handleSearchChange] = useDebouncedInput(search, (v) =>
    setFilter("search", v)
  );

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

      <Input
        className="w-64"
        placeholder="Search by name or email..."
        value={searchValue}
        onChange={(e) => handleSearchChange(e.target.value)}
      />

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

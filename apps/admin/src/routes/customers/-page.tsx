import { useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Input } from "@repo/ui/components/input";

import { listCustomersFn } from "@/server/customers";
import { customerColumns } from "@/components/customers";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { useFilteredNavigation } from "@/lib";

import { Route } from "./route";

export default function CustomersPage() {
  const { page, search } = Route.useSearch();
  const currentPage = page ?? 1;
  const [inputValue, setInputValue] = useState(search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setFilter, goToPage } = useFilteredNavigation("/customers");

  const handleSearch = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilter("search", value), 300);
  };

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
        value={inputValue}
        onChange={(e) => handleSearch(e.target.value)}
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

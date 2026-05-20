import { useCallback, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Input } from "@repo/ui/components/input";

import { listCustomersFn } from "@/server/customers";
import { customerColumns } from "@/components/customers/customer-columns";
import { DataTable } from "@/components/data-table/data-table";

import { Route } from "./customers.route";

export default function CustomersPage() {
  const navigate = useNavigate();
  const { page, search } = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inputValue, setInputValue] = useState(search);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", { page, search }],
    queryFn: () =>
      listCustomersFn({
        data: { page, ...(search ? { search } : {}) },
      }),
    initialData: page === 1 && !search ? loaderData : undefined,
  });

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({
          to: "/customers",
          search: (prev) => ({ ...prev, search: value, page: 1 }),
        });
      }, 300);
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/customers",
        search: (prev) => ({ ...prev, page: newPage }),
      });
    },
    [navigate]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Customers</h1>

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
        page={page}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

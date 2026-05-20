import { useCallback, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Input } from "@repo/ui/components/input";

import { listProductsFn } from "@/server/products";
import { AddProductDrawer, getProductColumns } from "@/components/products";
import { DataTable } from "@/components";
import { can, useSession } from "@/lib";

import { Route } from "./route";

// ── Products Page ──────────────────────────────────────────────────────────

export default function ProductsPage() {
  const navigate = useNavigate();
  const { page, search } = Route.useSearch();
  const loaderData = Route.useLoaderData();

  const [inputValue, setInputValue] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { session } = useSession();
  const role = session?.role ?? "CUSTOMER";
  const canWrite = can(role, "products:write");

  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate({
          to: "/products",
          search: (prev) => ({ ...prev, search: value, page: 1 }),
        });
      }, 300);
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigate({
        to: "/products",
        search: (prev) => ({ ...prev, page: newPage }),
      });
    },
    [navigate]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["products", { page, search }],
    queryFn: () =>
      listProductsFn({
        data: { page, limit: 20, ...(search ? { search } : {}) },
      }),
    initialData: page === 1 && !search ? loaderData : undefined,
  });

  const columns = useMemo(() => getProductColumns(canWrite), [canWrite]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Products</h1>

      {/* Search + Add Product in one row */}
      <div className="flex items-center gap-2">
        <Input
          className="w-64"
          placeholder="Search products..."
          aria-label="Search products"
          value={inputValue}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {canWrite && <AddProductDrawer />}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={page}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

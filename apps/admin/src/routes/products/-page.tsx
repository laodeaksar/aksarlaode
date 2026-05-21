import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { listProductsFn } from "@/server/products";
import { PageHeader } from "@/components/layout/page-header";
import { productColumns } from "@/components/products";
import { DataTable } from "@/components";
import {
  can,
  useDebouncedInput,
  useFilteredNavigation,
  useSession,
} from "@/lib";

import { Route } from "./route";

// ── Products Page ──────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { page, search } = Route.useSearch();
  const currentPage = page ?? 1;

  const { session } = useSession();
  const canWrite = can(session?.role ?? "CUSTOMER", "products:write");

  const { setFilter, goToPage } = useFilteredNavigation("/products");
  const [searchValue, handleSearchChange] = useDebouncedInput(search, (v) =>
    setFilter("search", v)
  );

  const { data, isLoading } = useQuery({
    queryKey: ["products", { page: currentPage, search }],
    queryFn: () =>
      listProductsFn({
        data: { page: currentPage, limit: 20, ...(search ? { search } : {}) },
      }),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Produk" />

      <div className="flex items-center gap-2">
        <Input
          className="w-64"
          placeholder="Cari produk..."
          aria-label="Cari produk"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {canWrite && (
          <Button asChild size="sm">
            <Link to="/products/new">+ Tambah Produk</Link>
          </Button>
        )}
      </div>

      <DataTable
        columns={productColumns}
        data={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={currentPage}
        onPageChange={goToPage}
      />
    </div>
  );
}

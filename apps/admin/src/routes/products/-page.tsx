import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";

import { Button } from "@repo/ui/components/button";

import { listProductsFn } from "@/server/products";
import { PageHeader } from "@/components/layout/page-header";
import { productColumns } from "@/components/products";
import { ModuleEmptyState, SearchInput } from "@/components/shared";
import { DataTable, PaginationBar } from "@/components/data-table";
import {
  can,
  useDebouncedInput,
  useFilteredNavigation,
  useRouteSearch,
  useSession,
} from "@/lib";

import { Route } from "./route";

export default function ProductsPage() {
  const page = useRouteSearch(Route, (s) => s.page);
  const search = useRouteSearch(Route, (s) => s.search);

  const currentPage = page ?? 1;

  const { session } = useSession();
  const canWrite = can(session?.role ?? "CUSTOMER", "products:write");

  const { setFilter } = useFilteredNavigation("/products");
  const searchInput = useDebouncedInput(search, (v) => setFilter("search", v));

  const { data, isLoading } = useQuery({
    queryKey: ["products", { page: currentPage, search }],
    queryFn: () =>
      listProductsFn({
        data: { page: currentPage, limit: 20, ...(search ? { search } : {}) },
      }),
  });

  const emptyState = (
    <ModuleEmptyState
      icon={<PackageIcon />}
      title={search ? "Tidak ada produk ditemukan" : "Belum ada produk"}
      description={
        search
          ? `Tidak ada produk yang cocok dengan "${search}". Coba kata kunci lain.`
          : "Tambah produk pertama untuk mulai berjualan."
      }
      action={
        canWrite ? (
          <Button size="sm" render={<Link to="/products/new" />}>
            + Tambah Produk
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Produk" />

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder="Cari produk..."
          aria-label="Cari produk"
          {...searchInput}
        />
        {canWrite && (
          <Button size="sm" render={<Link to="/products/new" />}>
            + Tambah Produk
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <DataTable
          columns={productColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyState={emptyState}
        />
        <PaginationBar route={Route} to="/products" total={data?.total ?? 0} />
      </div>
    </div>
  );
}

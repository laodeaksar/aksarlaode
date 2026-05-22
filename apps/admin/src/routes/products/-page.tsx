import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/button";

import { listProductsFn } from "@/server/products";
import { PageHeader } from "@/components/layout/page-header";
import { productColumns } from "@/components/products";
import { SearchInput } from "@/components/shared";
import { DataTable, PaginationBar } from "@/components";
import {
  can,
  useDebouncedInput,
  useFilteredNavigation,
  useRouteSearch,
  useSession,
} from "@/lib";

import { Route } from "./route";

// ── Products Page ──────────────────────────────────────────────────────────

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
        />
        <PaginationBar route={Route} to="/products" total={data?.total ?? 0} />
      </div>
    </div>
  );
}

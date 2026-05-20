import { useCallback, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import type { Product } from "@repo/common";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { listProductsFn } from "@/server/products";
import { AddProductDrawer } from "@/components/add-product-drawer";
import { DeleteProductButton } from "@/components/delete-product-button";
import { DataTable } from "@/components";
import { can, useSession } from "@/lib";

import { Route } from "./products.route";

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

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.imageUrls?.[0] && (
              <img
                src={row.original.imageUrls[0]}
                width={40}
                height={40}
                loading="lazy"
                className="h-10 w-10 rounded object-cover"
                alt={row.original.name}
              />
            )}
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.original.sku}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => {
          const price = row.original.price;
          const comparePrice = row.original.comparePrice;
          return comparePrice ? (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground line-through">
                Rp {comparePrice.toLocaleString("id-ID")}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">
                  Rp {price.toLocaleString("id-ID")}
                </span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  Sale
                </Badge>
              </div>
            </div>
          ) : (
            <span>Rp {price.toLocaleString("id-ID")}</span>
          );
        },
      },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ getValue }) => {
          const stock = getValue() as number;
          return (
            <Badge
              variant={
                stock === 0
                  ? "destructive"
                  : stock < 10
                    ? "secondary"
                    : "default"
              }
            >
              {stock}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const variants = {
            ACTIVE: "default",
            DRAFT: "secondary",
            ARCHIVED: "outline",
          } as const;
          return (
            <Badge
              variant={variants[status as keyof typeof variants] ?? "outline"}
            >
              {status}
            </Badge>
          );
        },
      },
      ...(canWrite
        ? [
            {
              id: "actions",
              cell: ({ row }: { row: { original: Product } }) => (
                <div className="flex gap-2">
                  <Link
                    to="/products/$productId"
                    params={{ productId: row.original.id }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Edit product"
                    >
                      Edit
                    </Button>
                  </Link>
                  <DeleteProductButton productId={row.original.id} />
                </div>
              ),
            },
          ]
        : []),
    ],
    [canWrite]
  );

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

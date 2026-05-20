import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import type { Product } from "@repo/common";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

import { DeleteProductButton } from "@/components/delete-product-button";

export function getProductColumns(canWrite: boolean): ColumnDef<Product>[] {
  return [
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
            <p className="text-xs text-muted-foreground">{row.original.sku}</p>
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
  ];
}

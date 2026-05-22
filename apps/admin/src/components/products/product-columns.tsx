import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import { MoreHorizontal } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import type { Product } from "@/effect/Services";
import { can, formatIDR, useSession } from "@/lib";

import { DeleteProductButton } from "./delete-product-button";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

// ── Actions cell — uses hooks, must be its own component ──────────────────

function ProductActions({ row }: { row: { original: Product } }) {
  const { session } = useSession();
  const canWrite = session ? can(session.role, "products:write") : false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-8 w-8 p-0" />}
      >
        <span className="sr-only">Buka menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link
              to="/products/$productId"
              params={{ productId: row.original.id }}
              className="w-full cursor-pointer"
            />
          }
        >
          Lihat Detail
        </DropdownMenuItem>
        {canWrite && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  to="/products/$productId/edit"
                  params={{ productId: row.original.id }}
                  className="w-full cursor-pointer"
                />
              }
            >
              Edit Produk
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <DeleteProductButton
                productId={row.original.id}
                productName={row.original.name}
              />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────

export const productColumns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Produk",
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
          <p className="text-foreground font-medium">{row.original.name}</p>
          <p className="text-muted-foreground text-xs">{row.original.sku}</p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "price",
    header: "Harga",
    cell: ({ row }) => {
      const { price, comparePrice } = row.original;
      return comparePrice ? (
        <div className="space-y-0.5">
          <p className="text-muted-foreground text-xs line-through">
            {formatIDR(comparePrice)}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{formatIDR(price)}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              Sale
            </Badge>
          </div>
        </div>
      ) : (
        <span className="font-medium">{formatIDR(price)}</span>
      );
    },
  },
  {
    accessorKey: "stock",
    header: "Stok",
    cell: ({ getValue }) => {
      const stock = getValue() as number;
      return (
        <Badge
          variant={
            stock === 0 ? "destructive" : stock < 10 ? "secondary" : "default"
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
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>{status}</Badge>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <ProductActions row={row} />,
  },
];

import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";

import { PackageIcon } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { getProductFn } from "@/server/products";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceNotFound } from "@/components/shared";
import { can, formatIDR, queryKeys, useSession } from "@/lib";

import { DeleteProductButton } from "./delete-product-button";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

// ── Skeleton ───────────────────────────────────────────────────────────────

function ProductDetailSkeleton() {
  return (
    <div className="max-w-xl space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="bg-card border-border space-y-3 rounded-xl border p-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-44" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps) {
  const router = useRouter();
  const { session } = useSession();
  const canWrite = session ? can(session.role, "products:write") : false;

  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProductFn({ data: { id: productId } }),
  });

  if (isLoading && !product) return <ProductDetailSkeleton />;
  if (!product)
    return (
      <ResourceNotFound
        icon={<PackageIcon />}
        title="Produk tidak ditemukan"
        description="Produk ini mungkin sudah dihapus atau ID tidak valid."
        backTo="/products"
        backLabel="Lihat semua produk"
      />
    );

  const formattedCreatedAt = product.createdAt
    ? new Date(product.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const formattedUpdatedAt = product.updatedAt
    ? new Date(product.updatedAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Detail Produk" />

      {product.imageUrls?.[0] && (
        <img
          src={product.imageUrls[0]}
          alt={product.name}
          className="border-border h-40 w-40 rounded-xl border object-cover"
        />
      )}

      <div className="bg-card border-border space-y-4 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Nama</span>
          <span className="text-foreground font-medium">{product.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">SKU</span>
          <span className="text-foreground font-mono text-sm">
            {product.sku}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Harga</span>
          <div className="text-right">
            <span className="text-foreground font-medium">
              {formatIDR(product.price)}
            </span>
            {product.comparePrice && (
              <p className="text-muted-foreground text-xs line-through">
                {formatIDR(product.comparePrice)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Stok</span>
          <Badge
            variant={
              product.stock === 0
                ? "destructive"
                : product.stock < 10
                  ? "secondary"
                  : "default"
            }
          >
            {product.stock}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Status</span>
          <Badge variant={STATUS_VARIANTS[product.status] ?? "outline"}>
            {product.status}
          </Badge>
        </div>

        {product.description && (
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground shrink-0 text-sm">
              Deskripsi
            </span>
            <span className="text-foreground text-right text-sm">
              {product.description}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Dibuat</span>
          <span className="text-muted-foreground text-sm">
            {formattedCreatedAt}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Diperbarui</span>
          <span className="text-muted-foreground text-sm">
            {formattedUpdatedAt}
          </span>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-1">
          <span className="text-muted-foreground text-sm">ID</span>
          <span className="text-muted-foreground font-mono text-xs">
            {product.id}
          </span>
        </div>
      </div>

      {canWrite && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                to="/products/$productId/edit"
                params={{ productId: product.id }}
              />
            }
          >
            Edit Produk
          </Button>
          <DeleteProductButton
            productId={product.id}
            productName={product.name}
            onSuccess={() => router.navigate({ to: "/products" })}
          />
        </div>
      )}
    </div>
  );
}

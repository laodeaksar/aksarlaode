import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { getProductFn } from "@/server/products";
import { PageHeader } from "@/components/layout/page-header";
import { can, formatIDR, useSession } from "@/lib";

import { DeleteProductButton } from "./delete-product-button";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

// ── Skeleton ───────────────────────────────────────────────────────────────

function ProductDetailSkeleton() {
  return (
    <div className="space-y-4 max-w-xl">
      <Skeleton className="h-8 w-40" />
      <div className="bg-card rounded-xl border border-border p-6 space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
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
    queryKey: ["product", productId],
    queryFn: () => getProductFn({ data: { id: productId } }),
  });

  if (isLoading && !product) return <ProductDetailSkeleton />;
  if (!product)
    return <p className="p-6 text-red-500">Produk tidak ditemukan.</p>;

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
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Detail Produk" />

      {product.imageUrls?.[0] && (
        <img
          src={product.imageUrls[0]}
          alt={product.name}
          className="h-40 w-40 rounded-xl object-cover border border-border"
        />
      )}

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Nama</span>
          <span className="font-medium text-foreground">{product.name}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">SKU</span>
          <span className="font-mono text-sm text-foreground">
            {product.sku}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Harga</span>
          <div className="text-right">
            <span className="font-medium text-foreground">
              {formatIDR(product.price)}
            </span>
            {product.comparePrice && (
              <p className="text-xs text-muted-foreground line-through">
                {formatIDR(product.comparePrice)}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
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

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Status</span>
          <Badge variant={STATUS_VARIANTS[product.status] ?? "outline"}>
            {product.status}
          </Badge>
        </div>

        {product.description && (
          <div className="flex justify-between items-start gap-4">
            <span className="text-muted-foreground text-sm shrink-0">
              Deskripsi
            </span>
            <span className="text-sm text-foreground text-right">
              {product.description}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Dibuat</span>
          <span className="text-sm text-muted-foreground">
            {formattedCreatedAt}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Diperbarui</span>
          <span className="text-sm text-muted-foreground">
            {formattedUpdatedAt}
          </span>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-border">
          <span className="text-muted-foreground text-sm">ID</span>
          <span className="font-mono text-xs text-muted-foreground">
            {product.id}
          </span>
        </div>
      </div>

      {canWrite && (
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              to="/products/$productId/edit"
              params={{ productId: product.id }}
            >
              Edit Produk
            </Link>
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Skeleton } from "@repo/ui/components/skeleton";

import { getProductFn, updateProductFn } from "@/server/products";
import type { UpdateProductInput } from "@/effect/Services";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "@/lib";

import { ProductForm } from "../forms/product-form";

// ── Skeleton ───────────────────────────────────────────────────────────────
// Mirrors the Edit Product form shape: heading + 6 fields
// (Name, SKU, Price, Compare Price, Stock, Description) + submit button.

function EditProductSkeleton() {
  return (
    <div className="max-w-xl space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        {/* Description textarea — 3 rows */}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-[76px] w-full" />
        </div>
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function EditProduct({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Data is already in cache from the loader's ensureQueryData call (staleTime: 5 min).
  // No initialData needed — useQuery reads straight from cache.
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductFn({ data: { id: productId } }),
  });

  const mutation = useMutation({
    mutationFn: (body: UpdateProductInput) =>
      updateProductFn({ data: { id: productId, body } }),

    onMutate: async (updatedFields) => {
      await queryClient.cancelQueries({ queryKey: ["product", productId] });
      const previous = queryClient.getQueryData(["product", productId]);

      queryClient.setQueryData(["product", productId], (old: typeof product) =>
        old ? { ...old, ...updatedFields } : old
      );

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["product", productId], ctx.previous);
      }
      toast.error("Gagal memperbarui produk", err);
    },

    onSuccess: () => {
      toast.success("Produk berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      navigate({ to: "/products/$productId", params: { productId } });
    },
  });

  if (isLoading && !product) return <EditProductSkeleton />;

  if (!product) {
    return <p className="p-6 text-red-500">Produk tidak ditemukan.</p>;
  }

  const errorMessage = mutation.error
    ? mutation.error instanceof Error
      ? mutation.error.message
      : "Gagal mengupdate produk. Silakan coba lagi."
    : null;

  return (
    <div className="max-w-xl space-y-4">
      <PageHeader title="Edit Product" />
      <ProductForm
        defaultValues={{
          name: product.name,
          price: product.price,
          comparePrice: product.comparePrice,
          stock: product.stock,
          sku: product.sku,
          ...(product.description !== undefined && {
            description: product.description,
          }),
        }}
        onSubmit={(data) => mutation.mutate(data satisfies UpdateProductInput)}
        isLoading={mutation.isPending}
        error={errorMessage}
      />
    </div>
  );
}

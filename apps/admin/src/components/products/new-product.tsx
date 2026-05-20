import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { createProductFn } from "@/server/products";
import type { NewProductInput } from "@/effect/Services";
import { toast } from "@/lib";

import { ProductForm } from "../forms/product-form";

export function NewProduct() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: NewProductInput) => createProductFn({ data: input }),

    // Optimistic: add a placeholder row to the first page immediately.
    // Query key must match the shape used in products/-page.tsx:
    //   ["products", { page, search }]
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });

      const cacheKey = ["products", { page: 1, search: "" }];

      const previousData = queryClient.getQueryData<{
        items: { id: string; name: string }[];
        total: number;
      }>(cacheKey);

      queryClient.setQueryData(
        cacheKey,
        (old: typeof previousData) =>
          old
            ? {
                items: [
                  {
                    ...newProduct,
                    id: `optimistic-${Date.now()}`,
                    status: newProduct.status ?? "ACTIVE",
                    imageUrls: newProduct.imageUrls ?? [],
                    createdAt: new Date().toISOString(),
                  },
                  ...old.items,
                ],
                total: old.total + 1,
              }
            : old
      );

      return { previousData, cacheKey };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previousData) {
        queryClient.setQueryData(ctx.cacheKey, ctx.previousData);
      }
      toast.error("Gagal membuat produk", err);
    },

    onSuccess: () => {
      toast.success("Produk berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/products" });
    },
  });

  const errorMessage = mutation.error
    ? mutation.error instanceof Error
      ? mutation.error.message
      : "Gagal membuat produk. Silakan coba lagi."
    : null;

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold text-foreground">New Product</h1>
      <ProductForm
        onSubmit={(data) =>
          mutation.mutate({
            ...data,
            description: data.description?.trim() || undefined,
          } satisfies NewProductInput)
        }
        isLoading={mutation.isPending}
        error={errorMessage}
      />
    </div>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { createProductFn } from "@/server/products";
import type { NewProductInput } from "@/effect/Services";
import { ProductForm } from "@/components/forms/product-form";
import { can, toast } from "@/lib";

export const Route = createFileRoute("/products/new")({
  // Route-level RBAC: only ADMIN and OWNER can create products.
  // FINANCE is redirected back to the product list (read-only).
  beforeLoad: ({ context }) => {
    const { session } = context;
    if (!session || !can(session.role, "products:write")) {
      throw redirect({ to: "/products" });
    }
  },

  head: () => ({
    meta: [{ title: "New Product — Admin" }],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: NewProductInput) => createProductFn({ data: input }),

    // Optimistic: add a placeholder row to the first page immediately
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });

      // Query key must match the shape used in -products-page.tsx:
      //   ["products", { page, search }]
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

    // Roll back on error
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

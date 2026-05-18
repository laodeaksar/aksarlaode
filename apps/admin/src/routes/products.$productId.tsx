import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Skeleton } from "@repo/ui/components/skeleton"

import { getProductFn, updateProductFn } from "@/server/products"
import type { UpdateProductInput } from "@/effect/Services"
import { can, toast, type Session } from "@/lib"
import { ProductForm } from "@/components/forms/product-form"

export const Route = createFileRoute("/products/$productId")({
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session }
    if (!session || !can(session.role, "products:write")) {
      throw redirect({ to: "/products" as any })
    }
  },

  loader: ({ params }) => getProductFn({ data: { id: params.productId } }),

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Edit: ${loaderData.name} — Admin`
          : "Edit Product — Admin",
      },
    ],
  }),

  component: EditProductPage,
})

// ── Skeleton ───────────────────────────────────────────────────────────────
// Mirrors the Edit Product form shape: heading + 5 fields (Name, SKU, Price,
// Stock, Description) + submit button.

function EditProductSkeleton() {
  return (
    <div className="space-y-4 max-w-xl">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

function EditProductPage() {
  const { productId } = Route.useParams()
  const loaderProduct = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductFn({ data: { id: productId } }),
    initialData: loaderProduct ?? undefined,
  })

  const mutation = useMutation({
    mutationFn: (body: UpdateProductInput) =>
      updateProductFn({ data: { id: productId, body } }),

    onMutate: async (updatedFields) => {
      await queryClient.cancelQueries({ queryKey: ["product", productId] })
      const previous = queryClient.getQueryData(["product", productId])

      queryClient.setQueryData(["product", productId], (old: typeof product) =>
        old ? { ...old, ...updatedFields } : old
      )

      return { previous }
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["product", productId], ctx.previous)
      }
      toast.error("Gagal memperbarui produk", err)
    },

    onSuccess: () => {
      toast.success("Produk berhasil diperbarui")
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product", productId] })
      navigate({ to: "/products" })
    },
  })

  if (isLoading && !product) return <EditProductSkeleton />

  if (!product) {
    return <p className="p-6 text-red-500">Product not found.</p>
  }

  const errorMessage = mutation.error
    ? mutation.error instanceof Error
      ? mutation.error.message
      : "Gagal mengupdate produk. Silakan coba lagi."
    : null

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold text-foreground">Edit Product</h1>
      <ProductForm
        defaultValues={{
          name: product.name,
          price: product.price,
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
  )
}

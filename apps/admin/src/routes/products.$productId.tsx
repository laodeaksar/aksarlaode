import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { getProductFn, updateProductFn } from "@/server/products"
import type { UpdateProductInput } from "@/effect/Services"
import type { Session } from "@/lib/auth"
import { can } from "@/lib/rbac"
import { ProductForm } from "@/components/forms/product-form"

export const Route = createFileRoute("/products/$productId")({
  // Route-level RBAC: editing requires products:write (ADMIN / OWNER only).
  // A FINANCE user who navigates here directly is sent back to the list.
  beforeLoad: ({ context }) => {
    const { session } = context as { session?: Session }
    if (!session || !can(session.role, "products:write")) {
      throw redirect({ to: "/products" as any })
    }
  },

  // SSR loader: fetch the product server-side so the page is fully rendered
  // on first load — no client-visible loading spinner on navigation.
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

function EditProductPage() {
  const { productId } = Route.useParams()
  const loaderProduct = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Hydrate React Query cache from SSR loader data to avoid a second fetch
  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductFn({ data: { id: productId } }),
    initialData: loaderProduct ?? undefined,
  })

  const mutation = useMutation({
    mutationFn: (body: UpdateProductInput) =>
      updateProductFn({ data: { id: productId, body } }),

    // Optimistic update in the cache
    onMutate: async (updatedFields) => {
      await queryClient.cancelQueries({ queryKey: ["product", productId] })
      const previous = queryClient.getQueryData(["product", productId])

      queryClient.setQueryData(["product", productId], (old: typeof product) =>
        old ? { ...old, ...updatedFields } : old
      )

      return { previous }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["product", productId], ctx.previous)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product", productId] })
      navigate({ to: "/products" })
    },
  })

  if (isLoading && !product) {
    return <p className="p-6 text-gray-500">Loading product...</p>
  }

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
      <h1 className="text-2xl font-semibold text-gray-900">Edit Product</h1>
      <ProductForm
        defaultValues={{
          name: product.name,
          price: product.price,
          stock: product.stock,
          sku: product.sku,
          // exactOptionalPropertyTypes: spread only when defined to avoid
          // `description: string | undefined` vs `description?: string` mismatch.
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

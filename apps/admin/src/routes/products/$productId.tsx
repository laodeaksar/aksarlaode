import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ProductForm } from "@/components/forms/product-form"
import { productsApi } from "@/lib/api"

export const Route = createFileRoute("/products/$productId")({
  component: EditProductPage,
})

function EditProductPage() {
  const { productId } = Route.useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn:  () => productsApi.getOne(productId),
  })

  const mutation = useMutation({
    mutationFn: (body: any) => productsApi.update(productId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      navigate({ to: "/products" })
    },
  })

  if (isLoading) return <p className="p-6 text-gray-500">Loading product...</p>

  const product = data?.data
  if (!product) return <p className="p-6 text-red-500">Product not found.</p>

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900">Edit Product</h1>
      <ProductForm
        defaultValues={{
          name:        product.name,
          price:       product.price,
          stock:       product.stock,
          description: product.description,
          sku:         product.sku,
        }}
        onSubmit={(data) => mutation.mutate(data)}
        isLoading={mutation.isPending}
        error={mutation.error ? "Failed to update product" : null}
      />
    </div>
  )
}

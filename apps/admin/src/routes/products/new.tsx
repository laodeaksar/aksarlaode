import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient }  from "@tanstack/react-query"
import { ProductForm }                  from "../../components/forms/product-form"
import { productsApi }                  from "../../lib/api"

export const Route = createFileRoute("/products/new")({
  component: NewProductPage,
})

function NewProductPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      navigate({ to: "/products" })
    },
  })

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900">New Product</h1>
      <ProductForm
        onSubmit={(data) => mutation.mutate(data)}
        isLoading={mutation.isPending}
        error={mutation.error ? "Failed to create product" : null}
      />
    </div>
  )
}

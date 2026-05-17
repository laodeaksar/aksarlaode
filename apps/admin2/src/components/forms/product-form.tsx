import { useForm } from "react-hook-form"

import { effectResolver } from "@/lib/effect-resolver"
import { ProductFormSchema, type ProductFormValues } from "@/schemas/forms"

interface Props {
  defaultValues?: Partial<ProductFormValues>
  onSubmit: (data: ProductFormValues) => void
  isLoading: boolean
  error: string | null
}

export function ProductForm({
  defaultValues = {},
  onSubmit,
  isLoading,
  error,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: effectResolver(ProductFormSchema),
    defaultValues: {
      name: defaultValues.name ?? "",
      price: defaultValues.price ?? 0,
      stock: defaultValues.stock ?? 0,
      sku: defaultValues.sku ?? "",
      description: defaultValues.description ?? "",
    },
  })

  const onFormSubmit = handleSubmit((data) =>
    onSubmit({
      ...data,
      name: data.name.trim(),
      sku: data.sku.trim(),
      description: data.description?.trim() || "",
    }),
  )

  return (
    <form
      onSubmit={onFormSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
    >
      {error && (
        <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
      )}

      <div>
        <label
          htmlFor="pf-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <input
          id="pf-name"
          aria-label="Product name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="pf-sku"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          SKU
        </label>
        <input
          id="pf-sku"
          aria-label="Product SKU"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          {...register("sku")}
        />
        {errors.sku && (
          <p className="text-red-500 text-xs mt-1">{errors.sku.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="pf-price"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Price (IDR)
        </label>
        <input
          id="pf-price"
          type="number"
          min={1}
          aria-label="Product price"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          {...register("price", { valueAsNumber: true })}
        />
        {errors.price && (
          <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="pf-stock"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Stock
        </label>
        <input
          id="pf-stock"
          type="number"
          min={0}
          aria-label="Product stock"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          {...register("stock", { valueAsNumber: true })}
        />
        {errors.stock && (
          <p className="text-red-500 text-xs mt-1">{errors.stock.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="pf-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="pf-description"
          rows={3}
          aria-label="Product description"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          {...register("description")}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gray-900 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? "Saving..." : "Save Product"}
      </button>
    </form>
  )
}

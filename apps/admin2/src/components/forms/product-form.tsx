import { useForm } from "react-hook-form"

// ── Typed form values — mirrors NewProductInput from Effect Schema ──────────
// Using a local type keeps this component independent of the server layer.
// The Effect Schema in Services.ts is the authoritative validation at the
// server function boundary; this form adds a lightweight client-side guard
// so obviously invalid data never hits the network.

export type ProductFormValues = {
  name: string
  price: number
  stock: number
  sku: string
  description?: string
}

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
      description: data.description?.trim() || undefined,
    })
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
          {...register("name", {
            required: "Name wajib diisi.",
            validate: (v) => v.trim().length > 0 || "Name wajib diisi.",
          })}
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
          {...register("sku", {
            required: "SKU wajib diisi.",
            validate: (v) => v.trim().length > 0 || "SKU wajib diisi.",
          })}
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
          {...register("price", {
            required: "Price wajib diisi.",
            valueAsNumber: true,
            min: { value: 1, message: "Price harus lebih dari 0." },
          })}
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
          {...register("stock", {
            required: "Stock wajib diisi.",
            valueAsNumber: true,
            min: { value: 0, message: "Stock tidak boleh negatif." },
          })}
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

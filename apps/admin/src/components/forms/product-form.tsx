import { useState } from "react"

// ── Typed form values — mirrors NewProductInput from Effect Schema ──────────
// Using a local type keeps this component independent of the server layer.
// The Effect Schema in Services.ts is the authoritative validation at the
// server function boundary; this form adds a lightweight client-side guard
// so obviously invalid data never hits the network.

export type ProductFormValues = {
  name:         string
  price:        number
  stock:        number
  sku:          string
  description?: string
}

interface Props {
  defaultValues?: Partial<ProductFormValues>
  onSubmit:       (data: ProductFormValues) => void
  isLoading:      boolean
  error:          string | null
}

export function ProductForm({ defaultValues = {}, onSubmit, isLoading, error }: Props) {
  const [name,        setName]        = useState(defaultValues.name        ?? "")
  const [price,       setPrice]       = useState(defaultValues.price       ?? 0)
  const [stock,       setStock]       = useState(defaultValues.stock       ?? 0)
  const [description, setDescription] = useState(defaultValues.description ?? "")
  const [sku,         setSku]         = useState(defaultValues.sku         ?? "")
  const [formError,   setFormError]   = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // Client-side guard — catches obvious mistakes before hitting the server.
    // Effect Schema in the server function is the authoritative validator.
    if (!name.trim())  { setFormError("Name wajib diisi.");              return }
    if (!sku.trim())   { setFormError("SKU wajib diisi.");               return }
    if (price <= 0)    { setFormError("Price harus lebih dari 0.");      return }
    if (stock < 0)     { setFormError("Stock tidak boleh negatif.");     return }

    onSubmit({
      name:        name.trim(),
      price:       Number(price),
      stock:       Number(stock),
      sku:         sku.trim(),
      description: description.trim() || undefined,
    })
  }

  const displayError = formError ?? error

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {displayError && (
        <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{displayError}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          aria-label="Product name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
        <input
          value={sku}
          onChange={e => setSku(e.target.value)}
          required
          aria-label="Product SKU"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Price (IDR)</label>
        <input
          type="number"
          value={price}
          onChange={e => setPrice(Number(e.target.value))}
          min={1}
          required
          aria-label="Product price"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
        <input
          type="number"
          value={stock}
          onChange={e => setStock(Number(e.target.value))}
          min={0}
          required
          aria-label="Product stock"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          aria-label="Product description"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
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

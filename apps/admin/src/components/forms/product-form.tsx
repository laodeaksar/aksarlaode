import { useState } from "react"

interface Props {
  defaultValues?: {
    name?: string
    price?: number
    stock?: number
    description?: string
    sku?: string
  }
  onSubmit:  (data: any) => void
  isLoading: boolean
  error:     string | null
}

export function ProductForm({ defaultValues = {}, onSubmit, isLoading, error }: Props) {
  const [name,        setName]        = useState(defaultValues.name        ?? "")
  const [price,       setPrice]       = useState(defaultValues.price       ?? 0)
  const [stock,       setStock]       = useState(defaultValues.stock       ?? 0)
  const [description, setDescription] = useState(defaultValues.description ?? "")
  const [sku,         setSku]         = useState(defaultValues.sku         ?? "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, price: Number(price), stock: Number(stock), description, sku })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
        <input value={sku} onChange={e => setSku(e.target.value)} required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Price (IDR)</label>
        <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
        <input type="number" value={stock} onChange={e => setStock(Number(e.target.value))} min={0} required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
      </div>
      <button type="submit" disabled={isLoading}
        className="w-full bg-gray-900 text-white font-semibold py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
        {isLoading ? "Saving..." : "Save Product"}
      </button>
    </form>
  )
}

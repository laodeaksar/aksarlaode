import { useEffect, useState } from "react"

import { cartStore, type CartItem } from "@/lib/store/cart"

export function CartSummary() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    setItems(cartStore.getItems())
    const handler = () => setItems(cartStore.getItems())
    window.addEventListener("cart:updated", handler)
    return () => window.removeEventListener("cart:updated", handler)
  }, [])

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  if (items.length === 0) {
    return (
      <div class="text-center py-16">
        <p class="text-gray-500 mb-4">Your cart is empty.</p>
        <a
          href="/products"
          class="inline-block bg-gray-900 text-white px-6 py-2 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Browse Products
        </a>
      </div>
    )
  }

  return (
    <div class="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          class="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4"
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              class="w-16 h-16 object-cover rounded-lg"
            />
          )}
          <div class="flex-1">
            <p class="font-medium text-gray-900">{item.name}</p>
            <p class="text-sm text-gray-500">
              Rp {item.price.toLocaleString("id-ID")}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              onClick={() =>
                cartStore.updateQuantity(item.id, item.quantity - 1)
              }
              class="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              −
            </button>
            <span class="w-6 text-center font-medium">{item.quantity}</span>
            <button
              onClick={() =>
                cartStore.updateQuantity(item.id, item.quantity + 1)
              }
              class="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              +
            </button>
          </div>
          <button
            onClick={() => cartStore.removeItem(item.id)}
            class="text-red-400 hover:text-red-600 text-sm ml-2"
          >
            Remove
          </button>
        </div>
      ))}

      <div class="bg-white rounded-xl border border-gray-200 p-5 mt-4">
        <div class="flex justify-between items-center mb-4">
          <span class="text-gray-600">Total</span>
          <span class="text-xl font-bold text-gray-900">
            Rp {total.toLocaleString("id-ID")}
          </span>
        </div>
        <a
          href="/checkout"
          class="block w-full text-center bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Proceed to Checkout
        </a>
      </div>
    </div>
  )
}

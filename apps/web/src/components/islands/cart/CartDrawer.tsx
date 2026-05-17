import { useEffect, useState } from "react"

import { cartStore } from "@/lib/store/cart"

export function CartDrawer() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(cartStore.getCount())
    const handler = () => setCount(cartStore.getCount())
    window.addEventListener("cart:updated", handler)
    return () => window.removeEventListener("cart:updated", handler)
  }, [])

  return (
    <a
      href="/cart"
      class="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      aria-label="Cart"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {count > 0 && (
        <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </a>
  )
}

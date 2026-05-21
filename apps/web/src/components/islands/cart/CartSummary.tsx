import { cartStore, useCart } from "@/lib/store/cart";

export function CartSummary() {
  const { items, totalAmount } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-gray-500">Your cart is empty.</p>
        <a
          href="/products"
          className="inline-block rounded-xl bg-gray-900 px-6 py-2 text-white transition-colors hover:bg-gray-700"
        >
          Browse Products
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4"
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-16 w-16 rounded-lg object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="flex-1">
            <p className="font-medium text-gray-900">{item.name}</p>
            <p className="text-sm text-gray-500">
              Rp {item.price.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                cartStore.updateQuantity(item.id, item.quantity - 1)
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-6 text-center font-medium">{item.quantity}</span>
            <button
              onClick={() =>
                cartStore.updateQuantity(item.id, item.quantity + 1)
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            onClick={() => cartStore.removeItem(item.id)}
            className="ml-2 text-sm text-red-400 hover:text-red-600"
            aria-label={`Remove ${item.name}`}
          >
            Remove
          </button>
        </div>
      ))}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-gray-600">Total</span>
          <span className="text-xl font-bold text-gray-900">
            Rp {totalAmount.toLocaleString("id-ID")}
          </span>
        </div>
        <a
          href="/checkout"
          className="block w-full rounded-xl bg-gray-900 py-3 text-center font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Proceed to Checkout
        </a>
      </div>
    </div>
  );
}

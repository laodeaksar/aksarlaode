import { cartStore, useCart } from "@/lib/store/cart";

export function CartSummary() {
  const { items, totalAmount } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <a
          href="/products"
          className="inline-block bg-gray-900 text-white px-6 py-2 rounded-xl hover:bg-gray-700 transition-colors"
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
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4"
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-16 h-16 object-cover rounded-lg"
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
              onClick={() => cartStore.updateQuantity(item.id, item.quantity - 1)}
              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-6 text-center font-medium">{item.quantity}</span>
            <button
              onClick={() => cartStore.updateQuantity(item.id, item.quantity + 1)}
              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <button
            onClick={() => cartStore.removeItem(item.id)}
            className="text-red-400 hover:text-red-600 text-sm ml-2"
            aria-label={`Remove ${item.name}`}
          >
            Remove
          </button>
        </div>
      ))}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600">Total</span>
          <span className="text-xl font-bold text-gray-900">
            Rp {totalAmount.toLocaleString("id-ID")}
          </span>
        </div>
        <a
          href="/checkout"
          className="block w-full text-center bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Proceed to Checkout
        </a>
      </div>
    </div>
  );
}

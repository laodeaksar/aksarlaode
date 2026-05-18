import { useState } from "react";

import { cartStore } from "@/lib/store/cart";

interface Props {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  slug: string;
  inStock: boolean;
}

export function AddToCartButton({
  productId,
  name,
  price,
  imageUrl,
  slug,
  inStock,
}: Props) {
  const [added, setAdded] = useState(false);

  if (!inStock) {
    return (
      <button
        disabled
        class="w-full bg-gray-200 text-gray-400 font-semibold py-3 rounded-xl cursor-not-allowed"
      >
        Out of Stock
      </button>
    );
  }

  const handleAdd = () => {
    cartStore.addItem({
      id: productId,
      name,
      price,
      quantity: 1,
      imageUrl,
      slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      onClick={handleAdd}
      class={`w-full font-semibold py-3 rounded-xl transition-colors ${
        added
          ? "bg-green-600 text-white"
          : "bg-gray-900 text-white hover:bg-gray-700"
      }`}
    >
      {added ? "Added to Cart!" : "Add to Cart"}
    </button>
  );
}

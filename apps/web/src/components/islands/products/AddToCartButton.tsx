import { useState } from "react";

import { cartStore } from "@/lib/store/cart";

interface ProductProp {
  id: string;
  name: string;
  price: number;
  slug: string;
  stock: number;
  imageUrl?: string;
}

interface Props {
  product: ProductProp;
}

export function AddToCartButton({ product }: Props) {
  const [added, setAdded] = useState(false);
  const inStock = product.stock > 0;

  if (!inStock) {
    return (
      <button
        disabled
        className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-400"
      >
        Out of Stock
      </button>
    );
  }

  const handleAdd = () => {
    cartStore.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      onClick={handleAdd}
      className={`w-full rounded-xl py-3 font-semibold transition-colors ${
        added
          ? "bg-green-600 text-white"
          : "bg-gray-900 text-white hover:bg-gray-700"
      }`}
    >
      {added ? "Added to Cart!" : "Add to Cart"}
    </button>
  );
}

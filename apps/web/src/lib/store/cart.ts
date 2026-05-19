import { useEffect, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  slug: string;
};

const CART_KEY = "ec_cart";

// ── In-memory cache ───────────────────────────────────────────────────────────
// Eliminates repeated JSON.parse on every cartStore method call.
// Initialised lazily on first read, kept in sync by saveCart.
let _cache: CartItem[] | null = null;

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  if (_cache !== null) return _cache;
  try {
    _cache = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    return _cache!;
  } catch {
    return (_cache = []);
  }
}

function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  _cache = items;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const cartStore = {
  getItems: (): CartItem[] => loadCart(),

  addItem: (item: CartItem): void => {
    const items = loadCart();
    const existing = items.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      items.push(item);
    }
    saveCart(items);
    window.dispatchEvent(new CustomEvent("cart:updated"));
  },

  removeItem: (id: string): void => {
    saveCart(loadCart().filter((i) => i.id !== id));
    window.dispatchEvent(new CustomEvent("cart:updated"));
  },

  updateQuantity: (id: string, quantity: number): void => {
    const items = loadCart();
    const item = items.find((i) => i.id === id);
    if (item) {
      item.quantity = quantity;
      saveCart(quantity <= 0 ? items.filter((i) => i.id !== id) : items);
    }
    window.dispatchEvent(new CustomEvent("cart:updated"));
  },

  clearCart: (): void => {
    saveCart([]);
    window.dispatchEvent(new CustomEvent("cart:updated"));
  },

  getTotal: (): number =>
    loadCart().reduce((sum, i) => sum + i.price * i.quantity, 0),

  getCount: (): number =>
    loadCart().reduce((sum, i) => sum + i.quantity, 0),
};

// ── React hook ────────────────────────────────────────────────────────────────
// Replaces the scattered addEventListener("cart:updated") pattern across islands.
// Components that used to read cartStore directly can call useCart() instead.
export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() =>
    typeof window !== "undefined" ? loadCart() : []
  );

  useEffect(() => {
    // Sync on mount in case localStorage changed in another tab
    setItems(loadCart());
    const handler = () => setItems(loadCart());
    window.addEventListener("cart:updated", handler);
    return () => window.removeEventListener("cart:updated", handler);
  }, []);

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items,
    totalAmount,
    itemCount,
    clearCart: cartStore.clearCart,
  };
}

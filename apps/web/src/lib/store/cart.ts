export type CartItem = {
  id: string
  name: string
  price: number
  quantity: number
  imageUrl?: string
  slug: string
}

const CART_KEY = "ec_cart"

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]")
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(items))
}

export const cartStore = {
  getItems: (): CartItem[] => loadCart(),

  addItem: (item: CartItem): void => {
    const items = loadCart()
    const existing = items.find((i) => i.id === item.id)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      items.push(item)
    }
    saveCart(items)
    window.dispatchEvent(new CustomEvent("cart:updated"))
  },

  removeItem: (id: string): void => {
    const items = loadCart().filter((i) => i.id !== id)
    saveCart(items)
    window.dispatchEvent(new CustomEvent("cart:updated"))
  },

  updateQuantity: (id: string, quantity: number): void => {
    const items = loadCart()
    const item = items.find((i) => i.id === id)
    if (item) {
      item.quantity = quantity
      if (item.quantity <= 0) {
        saveCart(items.filter((i) => i.id !== id))
      } else {
        saveCart(items)
      }
    }
    window.dispatchEvent(new CustomEvent("cart:updated"))
  },

  clearCart: (): void => {
    saveCart([])
    window.dispatchEvent(new CustomEvent("cart:updated"))
  },

  getTotal: (): number =>
    loadCart().reduce((sum, i) => sum + i.price * i.quantity, 0),

  getCount: (): number => loadCart().reduce((sum, i) => sum + i.quantity, 0),
}

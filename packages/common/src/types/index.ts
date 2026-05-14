export type UserRole = "CUSTOMER" | "ADMIN"

export type User = {
  id:        string
  email:     string
  name:      string
  role:      UserRole
  createdAt?: string
}

export type Product = {
  id:          string
  name:        string
  slug:        string
  sku:         string
  description?: string
  price:       number
  stock:       number
  imageUrls?:  string[]
  categoryId?: string
  isActive?:   boolean
  createdAt?:  string
  updatedAt?:  string
}

export type NewProduct = {
  name:        string
  slug:        string
  sku:         string
  description?: string
  price:       number
  stock:       number
  imageUrls?:  string[]
  categoryId?: string
}

export type Payment = {
  id:         string
  orderId:    string
  userId:     string
  snapToken:  string
  snapUrl:    string
  amount:     number
  status:     string
  createdAt?: string
}

export type CreateOrderSchema = {
  items: Array<{
    productId: string
    quantity:  number
  }>
  shippingAddress: {
    recipientName: string
    phone:         string
    street:        string
    city:          string
    province:      string
    postalCode:    string
    notes?:        string
  }
}

export type OrderDetail = {
  orderId:         string
  userId:          string
  status:          string
  totalAmount:     number
  grandTotal:      number
  items:           Array<{ productId: string; name: string; price: number; quantity: number; subtotal: number }>
  shippingAddress: Record<string, string>
  statusHistory:   Array<{ status: string; note?: string; timestamp: string }>
  createdAt:       string
}



import type { OrderStatus } from "@/models/order.model"

export type { OrderStatus }

export type CreateOrderBody = {
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
    country?:      string
  }
  shippingFee?: number
  notes?:       string
  // discountAmount intentionally omitted — must come from a server-validated voucher, not client body
}

export type UpdateStatusBody = {
  status: OrderStatus
  note?:  string
}

import type { OrderStatus } from "@/models/order.model"

export type { OrderStatus }

export type CreateOrderBody = {
  items: Array<{
    productId:   string
    productName: string
    sku:         string
    imageUrl?:   string
    price:       number
    quantity:    number
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
  shippingFee?:    number
  discountAmount?: number
  notes?:          string
}

export type UpdateStatusBody = {
  status: OrderStatus
  note?:  string
}

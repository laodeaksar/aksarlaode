import { apiFetch } from "./client"
import type { CreateOrderInput, OrderDetail } from "@repo/common"

export const ordersApi = {
  create: (body: CreateOrderInput, cookie: string) =>
    apiFetch<{ orderId: string; grandTotal: number }>("/orders", {
      method: "POST",
      body:   JSON.stringify(body),
      cookie,
    }),

  getOne: (orderId: string, cookie: string) =>
    apiFetch<OrderDetail>(`/orders/${orderId}`, { cookie }),

  listMine: (cookie: string) =>
    apiFetch<{ items: OrderDetail[] }>("/orders", { cookie }),
}

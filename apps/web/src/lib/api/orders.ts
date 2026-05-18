import { apiFetch } from "./client";

export type OrderDetail = {
  orderId: string;
  userId: string;
  status: string;
  totalAmount?: number;
  grandTotal?: number;
  items?: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  shippingAddress?: Record<string, string>;
  statusHistory?: Array<{ status: string; note?: string; timestamp: string }>;
  createdAt: string;
};

export const ordersApi = {
  create: (body: any, cookie: string) =>
    apiFetch<{ orderId: string; grandTotal: number }>("/orders", {
      method: "POST",
      body: JSON.stringify(body),
      cookie,
    }),

  getOne: (orderId: string, cookie: string) =>
    apiFetch<OrderDetail>(`/orders/${orderId}`, { cookie }),

  list: (cookie: string) =>
    apiFetch<{ items: OrderDetail[] }>("/orders", { cookie }),

  listMine: (cookie: string) =>
    apiFetch<{ items: OrderDetail[] }>("/orders", { cookie }),
};

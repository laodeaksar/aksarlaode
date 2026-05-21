// ── src/types/api-responses.ts ────────────────────────────────────────────
//
// TYPE-04: Definizioni canoniche dei 4 response type admin-specific.
//
// Queste shape derivano dalle risposte HTTP dei microservizi (order, dashboard,
// audit). Vivono qui per rompere la dipendenza inversa:
//   Services.schemas.ts → lib/api.ts (client layer)
//
// Regola: importa sempre da "@/types" — mai da "@/lib/api".
// lib/api.ts re-esporta da qui per backward compat durante la transizione.
//
// NOTE: OrderSummary/OrderDetail dell'admin divergono da @repo/common/OrderDetail
// (campo items.productName vs .name, mancanza totalAmount).
// Riconciliare con il team order-service separatamente — fuori scope TYPE-03.

export type OrderSummary = {
  orderId: string;
  userId: string;
  status: string;
  grandTotal: number;
  createdAt: string;
};

export type OrderDetail = OrderSummary & {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  shippingAddress: Record<string, string>;
  statusHistory: Array<{ status: string; note?: string; timestamp: string }>;
};

export type DashboardStats = {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  revenueToday: number;
  ordersToday: number;
  recentOrders: OrderSummary[];
  topProducts: Array<{ id: string; name: string; salesCount: number }>;
};

// JSON-safe recursive value type — covers any value that can round-trip through
// JSON serialization (no `unknown`, no `Function`, no `Symbol`, no `undefined`).
type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonPrimitive | JsonObject | JsonArray };
type JsonArray = Array<JsonPrimitive | JsonObject | JsonArray>;

export type AuditLogEntry = {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue: JsonObject | null;
  newValue: JsonObject | null;
  metadata: JsonObject | null;
  createdAt: string;
};

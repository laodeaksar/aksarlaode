// ── src/types/api-responses.ts ────────────────────────────────────────────
//
// TYPE-04: Canonical response types for admin-specific API shapes.
// Regel: altijd importeren van "@/types" — nooit van "@/lib/api".

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

// JSON-safe recursive value type
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

// ── BullMQ Queue types ────────────────────────────────────────────────────

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

// PII-safe summary returned by the email-worker inspection endpoint.
// Email addresses, tokens, and personal data are stripped at source.
export type QueueFailedJob = {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
  orderId: string | null;
};

export type QueueActiveJob = {
  id: string;
  name: string;
  attemptsMade: number;
  /** Unix ms — when the job was enqueued. */
  timestamp: number;
  /** Unix ms — when the worker picked it up. */
  processedOn: number | null;
  orderId: string | null;
};

export type QueueCompletedJob = {
  id: string;
  name: string;
  /** Unix ms — when the job was enqueued. */
  timestamp: number;
  /** Unix ms — when the worker started processing. */
  processedOn: number | null;
  /** Unix ms — when the job finished. */
  finishedOn: number | null;
  /** Processing duration in milliseconds. */
  durationMs: number | null;
  orderId: string | null;
};

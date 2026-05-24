import { model, Schema, type Document } from "mongoose";

// ── Line item ─────────────────────────────────────────────
const LineItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    imageUrl: { type: String },
    price: { type: Number, required: true }, // snapshot at order time
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true }, // price * quantity
  },
  { _id: false }
);

// ── Shipping address ──────────────────────────────────────
const AddressSchema = new Schema(
  {
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: "ID" },
  },
  { _id: false }
);

// ── Status history entry ──────────────────────────────────
const StatusEventSchema = new Schema(
  {
    status: { type: String, required: true },
    note: { type: String },
    changedBy: { type: String, default: "system" }, // userId, "system", or "service:<name>"
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Order root ────────────────────────────────────────────
const OrderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true }, // "ORD-20240513-XXXXXXXX"
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAID",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING_PAYMENT",
      index: true,
    },
    items: { type: [LineItemSchema], required: true },
    shippingAddress: { type: AddressSchema, required: true },
    statusHistory: { type: [StatusEventSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 }, // totalAmount + shippingFee - discountAmount
    notes: { type: String },
    cancelledAt: { type: Date },
    paidAt: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: "__v", // optimistic concurrency
  }
);

// ── Indexes ───────────────────────────────────────────────
// Compound indexes for common query patterns
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
// Reconciliation sweep: quickly find stale pending orders
OrderSchema.index(
  { status: 1, createdAt: 1 },
  { partialFilterExpression: { status: "PENDING_PAYMENT" } }
);
// Revenue reporting: filter paid orders by payment date
OrderSchema.index({ paidAt: -1 }, { sparse: true });

// ── TypeScript types ──────────────────────────────────────

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type LineItem = {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
};

export type Address = {
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

export type StatusEvent = {
  status: string;
  note?: string;
  changedBy: string;
  timestamp: Date;
};

/**
 * Typed representation of an Order MongoDB document.
 *
 * Includes Mongoose-managed timestamp fields (createdAt, updatedAt) and
 * domain-specific timestamp fields (paidAt, shippedAt, deliveredAt,
 * cancelledAt) so callers never need `as any` to access them.
 */
export type OrderDocument = Document & {
  orderId: string;
  userId: string;
  status: OrderStatus;
  items: LineItem[];
  shippingAddress: Address;
  statusHistory: StatusEvent[];
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  grandTotal: number;
  notes?: string;
  // Mongoose timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
  // Domain timestamps — set when the order reaches each status
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
};

export const OrderModel = model<OrderDocument>("Order", OrderSchema);

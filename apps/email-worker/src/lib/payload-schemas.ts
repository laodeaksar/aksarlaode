import * as v from "valibot";

// P1 FIX: safeUrl() blocks javascript: / data: / vbscript: protocol URLs.
// Valibot's v.url() accepts "javascript:alert(1)" as valid — any field
// rendered inside an href attribute must use safeUrl() to prevent XSS
// in email clients.
const SAFE_URL_PROTOCOLS = /^https?:\/\//i;
const safeUrl = () =>
  v.pipe(
    v.string(),
    v.url(),
    v.check(
      (url) => SAFE_URL_PROTOCOLS.test(url),
      "URL must use http or https protocol"
    )
  );

export const OrderCreatedSchema = v.object({
  orderId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
  userEmail: v.pipe(v.string(), v.email()),
  grandTotal: v.pipe(v.number(), v.minValue(1)),
});

export const OrderConfirmationSchema = v.object({
  orderId: v.pipe(v.string(), v.minLength(1)),
  userId: v.optional(v.string()),
  userEmail: v.pipe(v.string(), v.email()),
  amount: v.pipe(v.number(), v.minValue(1)),
});

export const OrderCancelledSchema = v.object({
  orderId: v.pipe(v.string(), v.minLength(1)),
  userId: v.optional(v.string()),
  userEmail: v.pipe(v.string(), v.email()),
  reason: v.pipe(v.string(), v.minLength(1)),
});

export const PasswordResetSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
  // safeUrl() blocks javascript:, data:, vbscript: — these pass v.url()
  // but would execute as JS in email clients that render active content.
  resetLink: safeUrl(),
});

export const ShippingUpdateSchema = v.object({
  orderId: v.pipe(v.string(), v.minLength(1)),
  userId: v.optional(v.string()),
  userEmail: v.pipe(v.string(), v.email()),
  trackingNumber: v.pipe(v.string(), v.minLength(1)),
  courierName: v.pipe(v.string(), v.minLength(1)),
  estimatedDate: v.pipe(v.string(), v.minLength(1)),
});

export const StaffInviteSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(1)),
  role: v.pipe(v.string(), v.minLength(1)),
  // Same safeUrl() protection as resetLink — rendered inside href.
  inviteLink: safeUrl(),
});

export const PAYLOAD_SCHEMAS = {
  "order-created": OrderCreatedSchema,
  "order-confirmation": OrderConfirmationSchema,
  "order-cancelled": OrderCancelledSchema,
  "password-reset": PasswordResetSchema,
  "shipping-update": ShippingUpdateSchema,
  "staff-invite": StaffInviteSchema,
} as const;

export type PayloadSchemaMap = typeof PAYLOAD_SCHEMAS;

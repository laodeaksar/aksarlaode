import { z } from "zod";

// FIX EML-07: Zod schemas for every email job payload type.
// The processor validates inbound jobs against these schemas before dispatching
// to handlers. A job with a malformed payload is rejected immediately with a
// clear error rather than crashing inside the handler with a confusing TypeError.

export const OrderCreatedSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  userEmail: z.string().email(),
  grandTotal: z.number().positive(),
});

export const OrderConfirmationSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().optional(),
  userEmail: z.string().email(),
  amount: z.number().positive(),
});

export const OrderCancelledSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().optional(),
  userEmail: z.string().email(),
  reason: z.string().min(1),
});

export const PasswordResetSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  resetLink: z.string().url(),
});

export const ShippingUpdateSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().optional(),
  userEmail: z.string().email(),
  trackingNumber: z.string().min(1),
  courierName: z.string().min(1),
  estimatedDate: z.string().min(1),
});

export const PAYLOAD_SCHEMAS = {
  "order-created": OrderCreatedSchema,
  "order-confirmation": OrderConfirmationSchema,
  "order-cancelled": OrderCancelledSchema,
  "password-reset": PasswordResetSchema,
  "shipping-update": ShippingUpdateSchema,
} as const;

export type PayloadSchemaMap = typeof PAYLOAD_SCHEMAS;

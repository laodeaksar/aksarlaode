import { z } from "zod";

// P1 FIX: safeUrl() blocks javascript: / data: / vbscript: protocol URLs.
// Zod's built-in z.string().url() accepts "javascript:alert(1)" as valid
// (confirmed: safeParse returns success:true). Any field rendered inside an
// href attribute must use safeUrl() to prevent XSS in email clients.
const SAFE_URL_PROTOCOLS = /^https?:\/\//i;
const safeUrl = () =>
  z
    .string()
    .url()
    .refine((url) => SAFE_URL_PROTOCOLS.test(url), {
      message: "URL must use http or https protocol",
    });

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
  // safeUrl() blocks javascript:, data:, vbscript: — these pass z.string().url()
  // but would execute as JS in email clients that render active content.
  resetLink: safeUrl(),
});

export const ShippingUpdateSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().optional(),
  userEmail: z.string().email(),
  trackingNumber: z.string().min(1),
  courierName: z.string().min(1),
  estimatedDate: z.string().min(1),
});

export const StaffInviteSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().min(1),
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

import { z } from "zod/v4"

import { ALLOWED_AVATAR_HOSTS, isAllowedAvatarUrl } from "../lib/avatar"

export const InitiatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive().int(),
  customerName: z.string().min(1),
  customerEmail: z.email(),
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        price: z.number().positive().int(),
        quantity: z.number().positive().int(),
      })
    )
    .min(1),
})

export const RegisterSchema = z.object({
  email: z.email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(72),
})

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const ForgotPasswordSchema = z.object({
  email: z.email(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
})

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  })

export const UpdateProfileSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(7).max(20).optional(),

    /**
     * avatarUrl must be an HTTPS URL from a trusted CDN or avatar service.
     *
     * Enforces the same allowlist/blocklist as isAllowedAvatarUrl so that schema
     * validation catches disallowed domains at the boundary — before any handler
     * logic runs.  This protection applies to every service that imports this
     * schema, not just auth-service.
     *
     * Allowed hosts: gravatar.com, ui-avatars.com, api.dicebear.com,
     * res.cloudinary.com, images.unsplash.com, cdn.jsdelivr.net,
     * lh3.googleusercontent.com, avatars.githubusercontent.com.
     *
     * Services with a self-hosted CDN should additionally validate against their
     * own origin in the handler layer using apps/auth-service/src/lib/avatar.ts.
     */
    avatarUrl: z
      .string()
      .url()
      .max(500)
      .refine((url) => isAllowedAvatarUrl(url), {
        message: `avatarUrl must be an HTTPS URL from an allowed domain. Allowed: ${ALLOWED_AVATAR_HOSTS}`,
      })
      .optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined),
    { message: "At least one field must be provided" }
  )

export const ProductFiltersSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  inStock: z.boolean().optional(),
  sortBy: z.enum(["price_asc", "price_desc", "newest", "popular"]).optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  // FIX PRD-07: optional cursor for cursor-based pagination.
  // When provided, `page` is ignored and the result set starts after the
  // item represented by the cursor (base64url-encoded createdAt + id).
  cursor: z.string().optional(),
})

// ── Create order ───────────────────────────────────────────────────────────
export const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        productName: z.string().min(1),
        sku: z.string().min(1),
        imageUrl: z.string().url().optional(),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  shippingAddress: z.object({
    recipientName: z.string().min(1),
    phone: z.string().min(1),
    street: z.string().min(1),
    city: z.string().min(1),
    province: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().default("ID"),
  }),
  shippingFee: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

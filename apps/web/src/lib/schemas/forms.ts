import { z } from "zod/v4"

// ── Auth ───────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password required"),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name too short").max(100),
    email: z.email("Invalid email"),
    password: z.string().min(8, "Min 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

// ── Checkout ───────────────────────────────────────────────
export const checkoutSchema = z.object({
  recipientName: z.string().min(2, "Name required"),
  phone: z.string().min(9, "Invalid phone").max(15),
  street: z.string().min(5, "Street address required"),
  city: z.string().min(2, "City required"),
  province: z.string().min(2, "Province required"),
  postalCode: z.string().length(5, "5-digit postal code"),
  notes: z.string().max(200).optional(),
})

// Inferred types used in RHF
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>

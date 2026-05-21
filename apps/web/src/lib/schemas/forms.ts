import * as v from "valibot";

// ── Auth ───────────────────────────────────────────────────
export const loginSchema = v.object({
  email: v.pipe(v.string(), v.email("Invalid email")),
  password: v.pipe(v.string(), v.minLength(1, "Password required")),
});

export const registerSchema = v.pipe(
  v.object({
    name: v.pipe(v.string(), v.minLength(2, "Name too short"), v.maxLength(100)),
    email: v.pipe(v.string(), v.email("Invalid email")),
    password: v.pipe(v.string(), v.minLength(8, "Min 8 characters")),
    confirmPassword: v.string(),
  }),
  v.forward(
    v.partialCheck(
      [["password"], ["confirmPassword"]],
      (input) => input.password === input.confirmPassword,
      "Passwords don't match"
    ),
    ["confirmPassword"]
  )
);

// ── Checkout ───────────────────────────────────────────────
export const checkoutSchema = v.object({
  recipientName: v.pipe(v.string(), v.minLength(2, "Name required")),
  phone: v.pipe(v.string(), v.minLength(9, "Invalid phone"), v.maxLength(15)),
  street: v.pipe(v.string(), v.minLength(5, "Street address required")),
  city: v.pipe(v.string(), v.minLength(2, "City required")),
  province: v.pipe(v.string(), v.minLength(2, "Province required")),
  postalCode: v.pipe(v.string(), v.length(5, "5-digit postal code")),
  notes: v.optional(v.pipe(v.string(), v.maxLength(200))),
});

// Inferred output types — used in place of the old z.infer<> aliases
export type LoginInput = v.InferOutput<typeof loginSchema>;
export type RegisterInput = v.InferOutput<typeof registerSchema>;
export type CheckoutInput = v.InferOutput<typeof checkoutSchema>;

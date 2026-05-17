import { Schema } from "effect"

// ── Login ──────────────────────────────────────────────────────────────────

export const LoginSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Email wajib diisi." }),
    Schema.filter(
      (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
      { message: () => "Format email tidak valid." },
    ),
  ),
  password: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Password wajib diisi." }),
  ),
})

export type LoginFields = Schema.Schema.Type<typeof LoginSchema>

// ── Order status update ────────────────────────────────────────────────────

export const StatusUpdateSchema = Schema.Struct({
  // Must be one of the ORDER_STATUSES literals — validated as non-empty string
  // here; business-rule check (not same as current) stays in the UI layer.
  nextStatus: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Pilih status baru." }),
  ),
  // Always a string from the textarea; empty string is valid.
  note: Schema.String,
})

export type StatusFormFields = Schema.Schema.Type<typeof StatusUpdateSchema>

// ── Product form ───────────────────────────────────────────────────────────
// Mirrors NewProductSchema in effect/Services.ts but scoped to the form
// fields only (no imageUrls / status — those are not rendered in the form).
// `price` and `stock` are received as numbers because react-hook-form's
// `valueAsNumber: true` coerces the raw input string before the resolver runs.

export const ProductFormSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Name wajib diisi." }),
  ),
  price: Schema.Number.pipe(
    Schema.filter(
      (n) => Number.isFinite(n) && n > 0,
      { message: () => "Price harus lebih dari 0." },
    ),
  ),
  stock: Schema.Number.pipe(
    Schema.filter(
      (n) => Number.isFinite(n) && n >= 0,
      { message: () => "Stock tidak boleh negatif." },
    ),
  ),
  sku: Schema.String.pipe(
    Schema.minLength(1, { message: () => "SKU wajib diisi." }),
  ),
  // Always a string in the form (empty string = no description).
  // The submit handler trims and maps "" → undefined before sending to the API.
  description: Schema.String,
})

export type ProductFormValues = Schema.Schema.Type<typeof ProductFormSchema>

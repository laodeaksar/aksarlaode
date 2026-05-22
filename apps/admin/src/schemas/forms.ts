import * as v from "valibot";

// ── Login ──────────────────────────────────────────────────────────────────

export const LoginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.minLength(1, "Email wajib diisi."),
    v.email("Format email tidak valid.")
  ),
  password: v.pipe(v.string(), v.minLength(1, "Password wajib diisi.")),
});

export type LoginFields = v.InferOutput<typeof LoginSchema>;

// ── Order status update ────────────────────────────────────────────────────

export const StatusUpdateSchema = v.object({
  // Must be one of the ORDER_STATUSES literals — validated as non-empty string
  // here; business-rule check (not same as current) stays in the UI layer.
  nextStatus: v.pipe(v.string(), v.minLength(1, "Pilih status baru.")),
  // Always a string from the textarea; empty string is valid.
  note: v.string(),
});

export type StatusFormFields = v.InferOutput<typeof StatusUpdateSchema>;

// ── Product form ───────────────────────────────────────────────────────────
// Number inputs in HTML always yield string values via the DOM.  We coerce
// with v.transform before numeric validations — mirrors the original RHF
// `valueAsNumber: true` / `setValueAs` behaviour.
//
// `price` and `stock` are required numbers (> 0 and >= 0 respectively).
// `comparePrice` is optional — blank input → undefined, non-blank → number.

const coerceNumber = (val: unknown): number => {
  if (val === "" || val == null) return NaN;
  return Number(val);
};

const coerceOptionalNumber = (val: unknown): number | undefined => {
  if (val === "" || val == null) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
};

export const ProductFormSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, "Name wajib diisi.")),
  price: v.pipe(
    v.unknown(),
    v.transform(coerceNumber),
    v.check((n) => Number.isFinite(n) && n > 0, "Price harus lebih dari 0.")
  ),
  comparePrice: v.pipe(
    v.unknown(),
    v.transform(coerceOptionalNumber),
    v.check(
      (n): n is number | undefined =>
        n === undefined || (Number.isFinite(n) && n > 0),
      "Compare price harus lebih dari 0."
    )
  ),
  stock: v.pipe(
    v.unknown(),
    v.transform(coerceNumber),
    v.check((n) => Number.isFinite(n) && n >= 0, "Stock tidak boleh negatif.")
  ),
  sku: v.pipe(v.string(), v.minLength(1, "SKU wajib diisi.")),
  // Always a string in the form (empty string = no description).
  // The submit handler trims and maps "" → "" before sending to the API.
  description: v.string(),
});

export type ProductFormValues = v.InferOutput<typeof ProductFormSchema>;

// ── Store settings form ────────────────────────────────────────────────────
// All four settings fields are required; numeric fields coerce from HTML
// input values (always strings) the same way ProductFormSchema does.

export const SettingsFormSchema = v.object({
  paymentExpiryMinutes: v.pipe(
    v.unknown(),
    v.transform(coerceNumber),
    v.check(
      (n) => Number.isFinite(n) && n >= 1,
      "Payment window must be at least 1 minute."
    )
  ),
  minimumOrderAmount: v.pipe(
    v.unknown(),
    v.transform(coerceNumber),
    v.check(
      (n) => Number.isFinite(n) && n >= 0,
      "Minimum order amount cannot be negative."
    )
  ),
  maxOrderItemsPerOrder: v.pipe(
    v.unknown(),
    v.transform(coerceNumber),
    v.check(
      (n) => Number.isFinite(n) && n >= 1,
      "Max items per order must be at least 1."
    )
  ),
  maintenanceMode: v.boolean(),
});

export type SettingsFormValues = v.InferOutput<typeof SettingsFormSchema>;

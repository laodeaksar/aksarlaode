import { Schema } from "effect";

// ProductStatus and User are sourced from packages/common/src/types/index.ts.
// They are re-declared here as plain TypeScript types so this package has no
// runtime dependency on @repo/common (which has no default export entry point).

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type UserRole = "CUSTOMER" | "ADMIN" | "OWNER" | "FINANCE";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  deletedAt?: string | null;
};

// ── Admin product types ─────────────────────────────────────────────────────
// Aligned with @repo/common/Product (TYPE-03):
//   • All fields from @repo/common present
//   • status is required (not optional) — the product service always returns it
//   • comparePrice, slug, categoryId, isActive added as optional fields
export type Product = {
  id: string;
  name: string;
  slug?: string;
  sku: string;
  description: string | undefined;
  price: number;
  comparePrice?: number;
  stock: number;
  status: ProductStatus;
  imageUrls: string[] | undefined;
  categoryId?: string;
  isActive?: boolean;
  createdAt: string | undefined;
  updatedAt: string | undefined;
};

// Aligned with @repo/common/NewProduct (TYPE-03):
//   • slug optional — backend auto-generates from name when not supplied
//   • status and comparePrice added
//   • categoryId added
export type NewProduct = {
  name: string;
  slug?: string;
  sku: string;
  description?: string;
  price: number;
  comparePrice?: number;
  stock: number;
  status?: ProductStatus;
  imageUrls?: string[];
  categoryId?: string;
};

// ── Re-exported API response types ────────────────────────────────────────
// TYPE-04: definisi kanonik ada di src/types/api-responses.ts.
export type {
  AuditLogEntry,
  DashboardStats,
  OrderDetail,
  OrderSummary,
} from "@/types";

// ── Effect.Schema — request / response validation ─────────────────────────

export const ProductSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.optional(Schema.String),
  sku: Schema.String,
  description: Schema.optional(Schema.String),
  price: Schema.Number,
  comparePrice: Schema.optional(Schema.Number),
  stock: Schema.Number,
  status: Schema.Literal("ACTIVE", "DRAFT", "ARCHIVED"),
  imageUrls: Schema.optional(Schema.Array(Schema.String)),
  categoryId: Schema.optional(Schema.String),
  isActive: Schema.optional(Schema.Boolean),
  createdAt: Schema.optional(Schema.String),
  updatedAt: Schema.optional(Schema.String),
});
export type ProductDecoded = Schema.Schema.Type<typeof ProductSchema>;

export const ProductListSchema = Schema.Struct({
  items: Schema.Array(ProductSchema),
  total: Schema.Number,
});

export const NewProductSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  slug: Schema.optional(Schema.String),
  sku: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  price: Schema.Number.pipe(
    Schema.filter((n) => n > 0, { message: () => "price must be positive" })
  ),
  comparePrice: Schema.optional(Schema.Number),
  stock: Schema.Number.pipe(
    Schema.filter((n) => n >= 0, {
      message: () => "stock must be non-negative",
    })
  ),
  status: Schema.optional(Schema.Literal("ACTIVE", "DRAFT", "ARCHIVED")),
  imageUrls: Schema.optional(Schema.Array(Schema.String)),
  categoryId: Schema.optional(Schema.String),
});
export type NewProductInput = Schema.Schema.Type<typeof NewProductSchema>;

export const UpdateProductSchema = Schema.partial(NewProductSchema);
export type UpdateProductInput = Schema.Schema.Type<typeof UpdateProductSchema>;

// ── Store settings ─────────────────────────────────────────────────────────

export type StoreSettings = {
  paymentExpiryMinutes: number;
  minimumOrderAmount: number;
  maxOrderItemsPerOrder: number;
  maintenanceMode: boolean;
};

export const StoreSettingsSchema = Schema.Struct({
  paymentExpiryMinutes: Schema.Number.pipe(
    Schema.filter((n) => n >= 1, {
      message: () => "paymentExpiryMinutes must be ≥ 1",
    })
  ),
  minimumOrderAmount: Schema.Number.pipe(
    Schema.filter((n) => n >= 0, {
      message: () => "minimumOrderAmount must be ≥ 0",
    })
  ),
  maxOrderItemsPerOrder: Schema.Number.pipe(
    Schema.filter((n) => n >= 1, {
      message: () => "maxOrderItemsPerOrder must be ≥ 1",
    })
  ),
  maintenanceMode: Schema.Boolean,
});
export type StoreSettingsInput = Schema.Schema.Type<typeof StoreSettingsSchema>;

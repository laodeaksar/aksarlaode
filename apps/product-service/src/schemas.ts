import { t } from "elysia"

// ── Shared primitives ──────────────────────────────────────────────────────
export const ProductStatusSchema = t.Union([
  t.Literal("DRAFT"),
  t.Literal("ACTIVE"),
  t.Literal("ARCHIVED"),
])

// ── Product response shape (mirrors DB select type) ────────────────────────
export const ProductSchema = t.Object({
  id:           t.String({ format: "uuid" }),
  name:         t.String(),
  slug:         t.String(),
  sku:          t.String(),
  description:  t.Optional(t.String()),
  price:        t.Number(),
  comparePrice: t.Optional(t.Number()),
  stock:        t.Integer(),
  weight:       t.Optional(t.Number()),
  imageUrls:    t.Optional(t.Array(t.String({ format: "uri" }))),
  tags:         t.Optional(t.Array(t.String())),
  categoryId:   t.Optional(t.String({ format: "uuid" })),
  status:       ProductStatusSchema,
  isDigital:    t.Optional(t.Boolean()),
  salesCount:   t.Optional(t.Integer()),
  createdAt:    t.Optional(t.String({ format: "date-time" })),
  updatedAt:    t.Optional(t.String({ format: "date-time" })),
})

// ── Paginated list response ────────────────────────────────────────────────
export const ProductListResponseSchema = t.Object({
  items: t.Array(ProductSchema),
  total: t.Integer(),
  page:  t.Integer(),
  limit: t.Integer(),
})

// ── Query params for GET / (list) ──────────────────────────────────────────
export const ProductListQuerySchema = t.Object({
  search:     t.Optional(t.String({ description: "Full-text search on name and description" })),
  categoryId: t.Optional(t.String({ format: "uuid", description: "Filter by category" })),
  minPrice:   t.Optional(t.String({ description: "Minimum price (inclusive)" })),
  maxPrice:   t.Optional(t.String({ description: "Maximum price (inclusive)" })),
  inStock:    t.Optional(t.Union([t.Literal("true"), t.Literal("false")], { description: "Filter by stock availability" })),
  sortBy:     t.Optional(t.Union([
    t.Literal("price_asc"),
    t.Literal("price_desc"),
    t.Literal("newest"),
    t.Literal("popular"),
  ], { description: "Sort order" })),
  page:       t.Optional(t.String({ description: "Page number (default: 1)" })),
  limit:      t.Optional(t.String({ description: "Items per page, max 100 (default: 20)" })),
})

// ── Path params ────────────────────────────────────────────────────────────
export const ProductIdParamSchema = t.Object({
  id: t.String({ description: "Product UUID or slug" }),
})

// ── Create body ────────────────────────────────────────────────────────────
export const CreateProductBodySchema = t.Object({
  name:         t.String({ minLength: 1 }),
  slug:         t.String({ minLength: 1 }),
  sku:          t.String({ minLength: 1 }),
  description:  t.Optional(t.String()),
  price:        t.Number({ minimum: 0 }),
  comparePrice: t.Optional(t.Number({ minimum: 0 })),
  stock:        t.Integer({ minimum: 0 }),
  weight:       t.Optional(t.Number({ minimum: 0 })),
  imageUrls:    t.Optional(t.Array(t.String({ format: "uri" }))),
  tags:         t.Optional(t.Array(t.String())),
  categoryId:   t.Optional(t.String({ format: "uuid" })),
  status:       t.Optional(ProductStatusSchema),
  isDigital:    t.Optional(t.Boolean()),
})

// ── Update body (all fields optional) ─────────────────────────────────────
export const UpdateProductBodySchema = t.Partial(CreateProductBodySchema)

// ── Generic error response ─────────────────────────────────────────────────
export const ErrorSchema = t.Object({
  error: t.String(),
  code:  t.Optional(t.String()),
})

// ── Validation error response (422) ───────────────────────────────────────
// Matches the structured payload returned by the global onError handler.
export const ValidationErrorSchema = t.Object({
  error:  t.Literal("Validation failed"),
  code:   t.Literal("VALIDATION_ERROR"),
  source: t.Union([
    t.Literal("body"),
    t.Literal("query"),
    t.Literal("params"),
    t.Literal("headers"),
    t.Literal("request"),
  ], { description: "Which part of the request failed validation" }),
  fields: t.Array(
    t.Object({
      field:   t.String({ description: "JSON path of the invalid field, e.g. 'price' or 'items/0/name'" }),
      message: t.String({ description: "Human-readable reason the field failed" }),
    }),
    { description: "Per-field validation errors" }
  ),
})

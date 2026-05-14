import Elysia, { t }          from "elysia"
import { createHandler }       from "@/handlers/create"
import { listHandler }         from "@/handlers/list"
import { getOneHandler }       from "@/handlers/get-one"
import { cancelHandler }       from "@/handlers/cancel"
import { updateStatusHandler } from "@/handlers/update-status"
import { releaseStockHandler } from "@/handlers/release-stock"

// ── Shared param schemas ───────────────────────────────────────────────────
const OrderIdParamSchema = t.Object({
  orderId: t.String({ description: "Order ID (e.g. ORD-20240513-A3F9)" }),
})

const ErrorSchema = t.Object({
  error: t.String(),
  code:  t.Optional(t.String()),
})

// ── Request body schemas ───────────────────────────────────────────────────
const LineItemSchema = t.Object({
  productId:   t.String({ format: "uuid" }),
  productName: t.String({ minLength: 1 }),
  sku:         t.String({ minLength: 1 }),
  imageUrl:    t.Optional(t.String({ format: "uri" })),
  price:       t.Number({ minimum: 0 }),
  quantity:    t.Integer({ minimum: 1 }),
})

const AddressSchema = t.Object({
  recipientName: t.String({ minLength: 1 }),
  phone:         t.String({ minLength: 1 }),
  street:        t.String({ minLength: 1 }),
  city:          t.String({ minLength: 1 }),
  province:      t.String({ minLength: 1 }),
  postalCode:    t.String({ minLength: 1 }),
  country:       t.Optional(t.String()),
})

const CreateOrderBodySchema = t.Object({
  items:           t.Array(LineItemSchema, { minItems: 1 }),
  shippingAddress: AddressSchema,
  shippingFee:     t.Optional(t.Number({ minimum: 0 })),
  discountAmount:  t.Optional(t.Number({ minimum: 0 })),
  notes:           t.Optional(t.String()),
})

const UpdateStatusBodySchema = t.Object({
  status: t.Union([
    t.Literal("PAID"),
    t.Literal("PROCESSING"),
    t.Literal("SHIPPED"),
    t.Literal("DELIVERED"),
    t.Literal("CANCELLED"),
    t.Literal("REFUNDED"),
  ]),
  note: t.Optional(t.String()),
})

// ── Routes ─────────────────────────────────────────────────────────────────
export const orderRoutes = new Elysia({ prefix: "/orders", tags: ["Orders"] })

  .post("/", createHandler, {
    body: CreateOrderBodySchema,
    response: {
      201: t.Object({ orderId: t.String(), grandTotal: t.Number(), status: t.String() }),
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
      502: ErrorSchema,
    },
    detail: {
      summary:     "Create order",
      description: "Validates items, reserves stock atomically with rollback compensation on partial failure, persists order, and queues confirmation email.",
    },
  })

  .get("/", listHandler, {
    query: t.Object({
      page:  t.Optional(t.String({ description: "Page number (default: 1)" })),
      limit: t.Optional(t.String({ description: "Items per page (default: 20)" })),
    }),
    detail: {
      summary:     "List user orders",
      description: "Returns paginated orders for the authenticated user.",
    },
  })

  .get("/:orderId", getOneHandler, {
    params: OrderIdParamSchema,
    response: {
      200: t.Any(),
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary:     "Get order by ID",
      description: "Admin can fetch any order. Regular users can only fetch their own orders.",
    },
  })

  .post("/:orderId/cancel", cancelHandler, {
    params: OrderIdParamSchema,
    response: {
      200: t.Any(),
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary:     "Cancel order",
      description: "Only PENDING_PAYMENT and PAID orders can be cancelled.",
    },
  })

  .patch("/:orderId/status", updateStatusHandler, {
    params: OrderIdParamSchema,
    body:   UpdateStatusBodySchema,
    response: {
      200: t.Any(),
      404: ErrorSchema,
      422: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary:     "Update order status",
      description: "Admin-only status transition. Note is appended to statusHistory.",
    },
  })

  .post("/:orderId/release-stock", releaseStockHandler, {
    params: OrderIdParamSchema,
    response: {
      200: t.Object({ message: t.String(), orderId: t.String(), itemCount: t.Integer() }),
      404: ErrorSchema,
      500: ErrorSchema,
      502: ErrorSchema,
    },
    detail: {
      summary:     "Release reserved stock",
      description: "Releases all reserved stock for every line item back to product inventory.",
    },
  })

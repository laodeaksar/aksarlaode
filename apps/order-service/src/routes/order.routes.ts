import Elysia, { t }          from "elysia"
import { env }                 from "@repo/env/order"
import { createHandler }       from "@/handlers/create"
import { listHandler }         from "@/handlers/list"
import { getOneHandler }       from "@/handlers/get-one"
import { cancelHandler }       from "@/handlers/cancel"
import { updateStatusHandler } from "@/handlers/update-status"
import { releaseStockHandler } from "@/handlers/release-stock"

// ── Shared param schemas ───────────────────────────────────────────────────
const OrderIdParamSchema = t.Object({
  orderId: t.String({ description: "Order ID (e.g. ORD-20240513-A3F9B2C1)" }),
})

const ErrorSchema = t.Object({
  error: t.String(),
  code:  t.Optional(t.String()),
})

// ── Request body schemas ───────────────────────────────────────────────────
const LineItemSchema = t.Object({
  productId: t.String({ format: "uuid" }),
  quantity:  t.Integer({ minimum: 1 }),
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
  // shippingFee sent by client is informational only; authoritative value is set server-side
  shippingFee:     t.Optional(t.Number({ minimum: 0 })),
  notes:           t.Optional(t.String()),
  // discountAmount intentionally omitted — must only come from a server-validated voucher flow
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

  // ── Service token guard — all /orders routes require a trusted gateway token ─
  .onBeforeHandle(({ headers, set }) => {
    const serviceToken = headers["x-service-token"]
    if (serviceToken !== env.INTERNAL_SERVICE_TOKEN) {
      set.status = 401
      return { error: "Unauthorized", code: "MISSING_SERVICE_TOKEN" }
    }
  })

  .post("/", createHandler, {
    body: CreateOrderBodySchema,
    headers: t.Object({
      // Required — without idempotency key, retries can cause double orders
      "idempotency-key": t.String({
        minLength: 16,
        maxLength: 128,
        description: "Client-generated unique key (UUID v4 recommended). Makes the endpoint idempotent: duplicate requests with the same key within 24 h return the original response without creating a second order.",
        examples:    ["550e8400-e29b-41d4-a716-446655440000"],
      }),
    }, { additionalProperties: true }),
    response: {
      201: t.Object({ orderId: t.String(), grandTotal: t.Number(), status: t.String() }),
      404: ErrorSchema,
      409: ErrorSchema,
      500: ErrorSchema,
      502: ErrorSchema,
    },
    detail: {
      summary:     "Create order",
      description: "Fetches authoritative prices from product-service, reserves stock atomically with rollback compensation on partial failure, persists order, and queues confirmation email. Requires `Idempotency-Key` header.",
    },
  })

  .get("/", listHandler, {
    query: t.Object({
      page:  t.Optional(t.String({ description: "Page number (default: 1)" })),
      limit: t.Optional(t.String({ description: "Items per page, max 100 (default: 20)" })),
    }),
    response: {
      200: t.Object({
        items: t.Array(t.Object({
          orderId:  t.String(),
          userId:   t.String(),
          status:   t.String(),
          items: t.Array(t.Object({
            productId:   t.String(),
            productName: t.String(),
            sku:         t.String(),
            imageUrl:    t.Union([t.String(), t.Null()]),
            price:       t.Number(),
            quantity:    t.Integer(),
            subtotal:    t.Number(),
          })),
          shippingAddress: t.Object({
            recipientName: t.String(),
            phone:         t.String(),
            street:        t.String(),
            city:          t.String(),
            province:      t.String(),
            postalCode:    t.String(),
            country:       t.String(),
          }),
          totalAmount:    t.Number(),
          shippingFee:    t.Number(),
          discountAmount: t.Number(),
          grandTotal:     t.Number(),
          notes:          t.Union([t.String(), t.Null()]),
          statusHistory: t.Array(t.Object({
            status:    t.String(),
            note:      t.Union([t.String(), t.Null()]),
            changedBy: t.String(),
            timestamp: t.String(),
          })),
          createdAt:   t.Union([t.String(), t.Null()]),
          updatedAt:   t.Union([t.String(), t.Null()]),
          paidAt:      t.Union([t.String(), t.Null()]),
          shippedAt:   t.Union([t.String(), t.Null()]),
          deliveredAt: t.Union([t.String(), t.Null()]),
          cancelledAt: t.Union([t.String(), t.Null()]),
        })),
        total:      t.Integer(),
        page:       t.Integer(),
        limit:      t.Integer(),
        totalPages: t.Integer(),
        hasNext:    t.Boolean(),
        hasPrev:    t.Boolean(),
      }),
      500: ErrorSchema,
    },
    detail: {
      summary: "List user orders",
      description: [
        "Returns paginated orders for the authenticated user, newest first.",
        "Internal admin notes (__NOTE__ entries) are stripped from each order's statusHistory.",
        "Mongoose internals (_id, __v) are never included in the response.",
      ].join(" "),
    },
  })

  .get("/:orderId", getOneHandler, {
    params: OrderIdParamSchema,
    response: {
      200: t.Object({
        orderId:        t.String(),
        userId:         t.String(),
        status:         t.String(),
        items: t.Array(t.Object({
          productId:   t.String(),
          productName: t.String(),
          sku:         t.String(),
          imageUrl:    t.Union([t.String(), t.Null()]),
          price:       t.Number(),
          quantity:    t.Integer(),
          subtotal:    t.Number(),
        })),
        shippingAddress: t.Object({
          recipientName: t.String(),
          phone:         t.String(),
          street:        t.String(),
          city:          t.String(),
          province:      t.String(),
          postalCode:    t.String(),
          country:       t.String(),
        }),
        totalAmount:    t.Number(),
        shippingFee:    t.Number(),
        discountAmount: t.Number(),
        grandTotal:     t.Number(),
        notes:          t.Union([t.String(), t.Null()]),
        statusHistory: t.Array(t.Object({
          status:    t.String(),
          note:      t.Union([t.String(), t.Null()]),
          changedBy: t.String(),
          timestamp: t.String(),
        })),
        createdAt:   t.Union([t.String(), t.Null()]),
        updatedAt:   t.Union([t.String(), t.Null()]),
        paidAt:      t.Union([t.String(), t.Null()]),
        shippedAt:   t.Union([t.String(), t.Null()]),
        deliveredAt: t.Union([t.String(), t.Null()]),
        cancelledAt: t.Union([t.String(), t.Null()]),
      }),
      404: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Get order by ID",
      description: [
        "Returns full order detail for the authenticated user.",
        "Regular users can only fetch their own orders — requesting another user's order returns 404",
        "(not 403) to avoid leaking whether that order exists.",
        "Admin users may fetch any order.",
        "Internal admin notes (status __NOTE__) are stripped from statusHistory before the response is sent.",
      ].join(" "),
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
      403: ErrorSchema,
      404: ErrorSchema,
      422: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary:     "Update order status",
      description: "Admin-only or internal service status transition. Actor is recorded in statusHistory.",
    },
  })

  .post("/:orderId/release-stock", releaseStockHandler, {
    params: OrderIdParamSchema,
    response: {
      200: t.Object({ message: t.String(), orderId: t.String(), itemCount: t.Integer() }),
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
      502: ErrorSchema,
    },
    detail: {
      summary:     "Release reserved stock",
      description: "Internal service endpoint — releases all reserved stock for every line item back to product inventory.",
    },
  })

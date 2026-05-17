import { auditLogHandler } from "@/handlers/audit-log"
import { createHandler } from "@/handlers/create"
import { deleteHandler } from "@/handlers/delete"
import { getOneHandler } from "@/handlers/get-one"
import { getStockHandler } from "@/handlers/get-stock"
import { listHandler } from "@/handlers/list"
import { releaseStockHandler } from "@/handlers/release-stock"
import { reserveStockHandler } from "@/handlers/reserve-stock"
import { updateHandler } from "@/handlers/update"
import {
  writeAuditLogHandler,
  type WriteAuditLogBody,
} from "@/handlers/write-audit-log"
import {
  CreateProductBodySchema,
  ErrorSchema,
  InsufficientStockErrorSchema,
  ProductIdParamSchema,
  ProductListQuerySchema,
  ProductListResponseSchema,
  ProductSchema,
  StockOperationBodySchema,
  StockReleaseResponseSchema,
  StockReserveResponseSchema,
  StockResponseSchema,
  UpdateProductBodySchema,
  ValidationErrorSchema,
} from "@/schemas"
import Elysia, { t } from "elysia"

const ForbiddenSchema = ErrorSchema
const AdminDescription =
  "Requires `x-user-role: ADMIN` header forwarded by the gateway."

export const productRoutes = new Elysia({
  prefix: "/products",
  tags: ["Products"],
})

  .get("/", listHandler, {
    query: ProductListQuerySchema,
    response: {
      200: ProductListResponseSchema,
      422: ValidationErrorSchema,
    },
    detail: {
      summary: "List products",
      description:
        "Returns a paginated, filterable list of products. All query params are optional.",
    },
  })

  .post("/", createHandler, {
    body: CreateProductBodySchema,
    response: {
      201: ProductSchema,
      403: ForbiddenSchema,
      422: ValidationErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Create product",
      description: `Creates a new product. ${AdminDescription}`,
    },
  })

  .get("/:id/stock", getStockHandler, {
    params: ProductIdParamSchema,
    response: {
      200: StockResponseSchema,
      404: ErrorSchema,
    },
    detail: {
      summary: "Check product stock",
      description:
        "Returns only stock availability for a product by UUID. Intended for use by order-service before creating an order.",
    },
  })

  .post("/:id/stock/reserve", reserveStockHandler, {
    params: ProductIdParamSchema,
    body: StockOperationBodySchema,
    response: {
      200: StockReserveResponseSchema,
      404: ErrorSchema,
      409: InsufficientStockErrorSchema,
      422: ValidationErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Reserve (decrement) product stock",
      description:
        "Atomically decrements stock by `quantity`. Returns 409 if stock is insufficient. Intended for internal service-to-service calls from order-service.",
    },
  })

  .post("/:id/stock/release", releaseStockHandler, {
    params: ProductIdParamSchema,
    body: StockOperationBodySchema,
    response: {
      200: StockReleaseResponseSchema,
      404: ErrorSchema,
      422: ValidationErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Release (increment) product stock",
      description:
        "Adds `quantity` back to stock. Called by order-service on order cancellation or payment failure.",
    },
  })

  .get("/:id", getOneHandler, {
    params: ProductIdParamSchema,
    response: {
      200: ProductSchema,
      404: ErrorSchema,
    },
    detail: {
      summary: "Get product by ID or slug",
      description: "Accepts either a UUID or a URL-friendly slug.",
    },
  })

  .put("/:id", updateHandler, {
    params: ProductIdParamSchema,
    body: UpdateProductBodySchema,
    response: {
      200: ProductSchema,
      403: ForbiddenSchema,
      422: ValidationErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Update product",
      description: `Partial update — only the provided fields are changed. ${AdminDescription}`,
    },
  })

  .delete("/:id", deleteHandler, {
    params: ProductIdParamSchema,
    response: {
      200: t.Object({ message: t.Literal("Deleted") }),
      403: ForbiddenSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Delete product",
      description: `Permanently deletes a product by ID. ${AdminDescription}`,
    },
  })

  // Write endpoint: admin app's auditMiddleware POSTs here fire-and-forget.
  // Protected by x-service-token (checked in index.ts) + actorRole validation.
  .post("/audit-logs", writeAuditLogHandler, {
    body: t.Object({
      actorId: t.String(),
      actorRole: t.String(),
      action: t.String(),
      resource: t.String(),
      resourceId: t.String(),
      oldValue: t.Optional(t.Unknown()),
      newValue: t.Optional(t.Unknown()),
      metadata: t.Optional(t.Unknown()),
    }),
    response: {
      202: t.Object({ message: t.Literal("Accepted") }),
      403: ForbiddenSchema,
    },
    detail: {
      summary: "Write admin audit log entry",
      description:
        "Called internally by the admin SSR layer. Requires x-service-token.",
    },
  })

  // FIX ADM-06b: Read-only audit log endpoint for admin panel viewer.
  .get("/audit-logs", auditLogHandler, {
    response: {
      200: t.Object({
        items: t.Array(
          t.Object({
            id: t.String(),
            actorId: t.String(),
            actorRole: t.String(),
            action: t.String(),
            resource: t.String(),
            resourceId: t.String(),
            oldValue: t.Optional(t.Unknown()),
            newValue: t.Optional(t.Unknown()),
            metadata: t.Optional(t.Unknown()),
            createdAt: t.Union([t.String(), t.Date()]),
          })
        ),
        total: t.Number(),
        page: t.Number(),
        limit: t.Number(),
      }),
      403: ForbiddenSchema,
    },
    detail: {
      summary: "List admin audit log",
      description: `Returns recent sensitive admin actions. ${AdminDescription} OWNER also permitted.`,
    },
  })

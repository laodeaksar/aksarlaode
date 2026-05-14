import Elysia, { t }   from "elysia"
import { listHandler }     from "@/handlers/list"
import { createHandler }   from "@/handlers/create"
import { getOneHandler }   from "@/handlers/get-one"
import { getStockHandler } from "@/handlers/get-stock"
import { updateHandler }   from "@/handlers/update"
import { deleteHandler }   from "@/handlers/delete"
import {
  ProductSchema,
  ProductListResponseSchema,
  ProductListQuerySchema,
  ProductIdParamSchema,
  CreateProductBodySchema,
  UpdateProductBodySchema,
  StockResponseSchema,
  ErrorSchema,
  ValidationErrorSchema,
} from "@/schemas"

const ForbiddenSchema  = ErrorSchema
const AdminDescription = "Requires `x-user-role: ADMIN` header forwarded by the gateway."

export const productRoutes = new Elysia({ prefix: "/products", tags: ["Products"] })

  .get("/", listHandler, {
    query: ProductListQuerySchema,
    response: {
      200: ProductListResponseSchema,
      422: ValidationErrorSchema,
    },
    detail: {
      summary:     "List products",
      description: "Returns a paginated, filterable list of products. All query params are optional.",
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
      summary:     "Create product",
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
      summary:     "Check product stock",
      description: "Returns only stock availability for a product by UUID. Intended for use by order-service before creating an order.",
    },
  })

  .get("/:id", getOneHandler, {
    params: ProductIdParamSchema,
    response: {
      200: ProductSchema,
      404: ErrorSchema,
    },
    detail: {
      summary:     "Get product by ID or slug",
      description: "Accepts either a UUID or a URL-friendly slug.",
    },
  })

  .put("/:id", updateHandler, {
    params: ProductIdParamSchema,
    body:   UpdateProductBodySchema,
    response: {
      200: ProductSchema,
      403: ForbiddenSchema,
      422: ValidationErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary:     "Update product",
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
      summary:     "Delete product",
      description: `Permanently deletes a product by ID. ${AdminDescription}`,
    },
  })

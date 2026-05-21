import { createServerFn } from "@tanstack/react-start";

import { Effect, Schema } from "effect";

import { auditMiddleware } from "@/effect/AuditMiddleware";
import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import {
  ApiClientService,
  NewProductSchema,
  UpdateProductSchema,
  type NewProduct,
} from "@/effect/Services";

import { decodeOrThrow, stripUndefined } from "./_utils";

// ── Input schemas ──────────────────────────────────────────────────────────

const ListParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  limit: Schema.optionalWith(Schema.NumberFromString, { default: () => 20 }),
  search: Schema.optional(Schema.String),
});

const ProductIdSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
});

// ── GET /products — list with pagination & search ─────────────────────────
// requirePermission("products:read") provides defense-in-depth for direct
// server function endpoint calls, even though the route also guards via
// beforeLoad.

export const listProductsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("products:read")])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ListParamsSchema,
      raw as Schema.Schema.Encoded<typeof ListParamsSchema>
    )
  )
  .handler(async ({ data, context }) => {
    const params: { page: number; limit: number; search?: string } = {
      page: data.page,
      limit: data.limit,
    };
    if (data.search !== undefined) params.search = data.search;

    return context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.products.list(params);
      })
    );
  });

// ── GET /products/:id — fetch single product ──────────────────────────────

export const getProductFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("products:read")])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ProductIdSchema,
      raw as Schema.Schema.Encoded<typeof ProductIdSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.products.getOne(data.id);
      })
    )
  );

// ── POST /products — create product ───────────────────────────────────────

export const createProductFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("products:write"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      NewProductSchema,
      raw as Schema.Schema.Encoded<typeof NewProductSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.products.create(
          stripUndefined(
            data as unknown as Record<string, unknown>
          ) as NewProduct
        );
      })
    )
  );

// ── PUT /products/:id — update product ────────────────────────────────────

const UpdateParamsSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  body: UpdateProductSchema,
});

export const updateProductFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("products:write"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      UpdateParamsSchema,
      raw as Schema.Schema.Encoded<typeof UpdateParamsSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.products.update(
          data.id,
          stripUndefined(
            data.body as unknown as Record<string, unknown>
          ) as Partial<NewProduct>
        );
      })
    )
  );

// ── DELETE /products/:id ──────────────────────────────────────────────────

export const deleteProductFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("products:write"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ProductIdSchema,
      raw as Schema.Schema.Encoded<typeof ProductIdSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.products.delete(data.id);
      })
    )
  );

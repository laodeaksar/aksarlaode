import { auditMiddleware } from "@/effect/AuditMiddleware"
import { NotFoundError, ValidationError } from "@/effect/Errors"
import { effectMiddleware } from "@/effect/Middleware"
import {
  ApiClientService,
  NewProductSchema,
  UpdateProductSchema,
  type NewProduct,
} from "@/effect/Services"
import { createServerFn } from "@tanstack/react-start"
import { Effect, Schema } from "effect"

// ── Input schemas ──────────────────────────────────────────────────────────

const ListParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  limit: Schema.optionalWith(Schema.NumberFromString, { default: () => 20 }),
  search: Schema.optional(Schema.String),
})

const ProductIdSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
})

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decode via Effect.Schema, throwing a typed ValidationError on failure. */
function decodeOrThrow<A, I>(schema: Schema.Schema<A, I>, input: I): A {
  const result = Schema.decodeUnknownEither(schema)(input)
  if (result._tag === "Left") {
    throw new ValidationError({
      message: result.left.message ?? "Invalid input",
      input,
    })
  }
  return result.right
}

/**
 * Strip keys whose value is `undefined` from an object.
 *
 * With `exactOptionalPropertyTypes: true`, Effect.Schema's `partial()` produces
 * `{ x?: T | undefined }` while hand-written types use `{ x?: T }`.
 * Removing explicit undefined entries makes the two shapes compatible.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T
}

// ── GET /products — list with pagination & search ─────────────────────────
//
// Example usage in a route loader:
//   loader: () => listProductsFn({ data: { page: 1, search: "sneaker" } })
//
// Runs Effect.gen → ApiClientService.products.list entirely server-side via
// the shared AppRuntime injected by effectMiddleware.
// On the client, TanStack Start replays the call over an internal HTTP endpoint
// so no fetch logic bleeds into the browser bundle.

export const listProductsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
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
    }
    if (data.search !== undefined) params.search = data.search

    return context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService
        return yield* api.products.list(params)
      })
    )
  })

// ── GET /products/:id — fetch single product ──────────────────────────────

export const getProductFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ProductIdSchema,
      raw as Schema.Schema.Encoded<typeof ProductIdSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService
        const product = yield* api.products.getOne(data.id)

        if (!product) {
          yield* Effect.fail(
            new NotFoundError({ resource: "Product", id: data.id })
          )
        }

        return product
      })
    )
  )

// ── POST /products — create product ───────────────────────────────────────
//
// Optimistic update pattern (in the component):
//
//   const mutation = useMutation({
//     mutationFn: (input) => createProductFn({ data: input }),
//     onMutate: async (newProduct) => {
//       await qc.cancelQueries({ queryKey: ["products"] })
//       const prev = qc.getQueryData(["products", 1, ""])
//       qc.setQueryData(["products", 1, ""], (old) => ({
//         ...old,
//         items: [{ ...newProduct, id: `optimistic-${Date.now()}` }, ...(old?.items ?? [])],
//       }))
//       return { prev }
//     },
//     onError: (_err, _vars, ctx) => qc.setQueryData(["products", 1, ""], ctx?.prev),
//     onSettled: () => qc.invalidateQueries({ queryKey: ["products"] }),
//   })

export const createProductFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware, auditMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      NewProductSchema,
      raw as Schema.Schema.Encoded<typeof NewProductSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService
        // stripUndefined: schema partial produces `x?: T | undefined`;
        // NewProduct uses `x?: T` — strip explicit undefineds to align shapes.
        return yield* api.products.create(
          stripUndefined(
            data as unknown as Record<string, unknown>
          ) as NewProduct
        )
      })
    )
  )

// ── PUT /products/:id — update product ────────────────────────────────────

const UpdateParamsSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  body: UpdateProductSchema,
})

export const updateProductFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware, auditMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      UpdateParamsSchema,
      raw as Schema.Schema.Encoded<typeof UpdateParamsSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService
        return yield* api.products.update(
          data.id,
          stripUndefined(
            data.body as unknown as Record<string, unknown>
          ) as Partial<NewProduct>
        )
      })
    )
  )

// ── DELETE /products/:id ──────────────────────────────────────────────────

export const deleteProductFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware, auditMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ProductIdSchema,
      raw as Schema.Schema.Encoded<typeof ProductIdSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService
        return yield* api.products.delete(data.id)
      })
    )
  )

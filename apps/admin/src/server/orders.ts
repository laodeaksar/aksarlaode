import { effectMiddleware } from "@/effect/Middleware"
import { ApiClientService } from "@/effect/Services"
import type { OrderDetail, OrderSummary } from "@/effect/Services"
import { createServerFn } from "@tanstack/react-start"
import { Effect, Schema } from "effect"

import { decodeOrThrow } from "./_utils"

// ── Input schemas ──────────────────────────────────────────────────────────

const ListOrdersParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  status: Schema.optional(Schema.String),
})

const OrderIdSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
})

const UpdateOrderStatusSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  status: Schema.String.pipe(Schema.minLength(1)),
  note: Schema.optional(Schema.String),
})

// ── GET /orders — list with pagination & optional status filter ────────────
// Used as the SSR loader in `routes/orders/index.tsx` and re-called from
// `orders-page.tsx` whenever page or status filter changes.

export const listOrdersFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ListOrdersParamsSchema,
      raw as Schema.Schema.Encoded<typeof ListOrdersParamsSchema>
    )
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ items: OrderSummary[]; total: number }> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService
          const params: { page: number; status?: string } = { page: data.page }
          if (data.status !== undefined) params.status = data.status
          return yield* api.orders.list(params)
        })
      )
  )

// ── PATCH /orders/:id/status — update order status ────────────────────────
// Replaces the legacy client-side `ordersApi.updateStatus()` call.
// Runs server-side so the service-to-service token is never exposed to the
// browser. On success the caller invalidates ["order", orderId] in the cache.

export const updateOrderStatusFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      UpdateOrderStatusSchema,
      raw as Schema.Schema.Encoded<typeof UpdateOrderStatusSchema>
    )
  )
  .handler(
    async ({ data, context }): Promise<void> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService
          yield* api.orders.updateStatus(
            data.id,
            data.status,
            data.note
          )
        })
      )
  )

// ── GET /orders/:id — single order detail ─────────────────────────────────
// Used as the SSR loader in `routes/orders.$orderId.tsx` and re-called by
// `useQuery` after a status mutation invalidates the cache.

export const getOrderFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      OrderIdSchema,
      raw as Schema.Schema.Encoded<typeof OrderIdSchema>
    )
  )
  .handler(
    async ({ data, context }): Promise<OrderDetail> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService
          return yield* api.orders.getOne(data.id)
        })
      )
  )

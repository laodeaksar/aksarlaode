import { effectMiddleware } from "@/effect/Middleware"
import { ApiClientService } from "@/effect/Services"
import type { OrderSummary } from "@/effect/Services"
import { createServerFn } from "@tanstack/react-start"
import { Effect, Schema } from "effect"

import { decodeOrThrow } from "./_utils"

// ── Input schema ───────────────────────────────────────────────────────────

const ListOrdersParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  status: Schema.optional(Schema.String),
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

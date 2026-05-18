import { createServerFn } from "@tanstack/react-start";

import { Effect, Schema } from "effect";

import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";
import type { User } from "@/effect/Services";

import { decodeOrThrow } from "./_utils";

// ── Input schemas ──────────────────────────────────────────────────────────

const ListCustomersParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  search: Schema.optional(Schema.String),
});

const CustomerIdSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
});

// ── GET /admin/customers — paginated list with optional search ─────────────
// Used as the SSR loader in `routes/customers.route.tsx` and re-called from
// `customers-page.tsx` whenever page or debounced search term changes.

export const listCustomersFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ListCustomersParamsSchema,
      raw as Schema.Schema.Encoded<typeof ListCustomersParamsSchema>
    )
  )
  .handler(
    async ({ data, context }): Promise<{ items: User[]; total: number }> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          return yield* api.customers.list({
            page: data.page,
            search: data.search,
          });
        })
      )
  );

// ── GET /admin/customers/:id — single customer ────────────────────────────
// Used as the SSR loader in `routes/customers.$userId.tsx`.

export const getCustomerFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      CustomerIdSchema,
      raw as Schema.Schema.Encoded<typeof CustomerIdSchema>
    )
  )
  .handler(
    async ({ data, context }): Promise<User> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          return yield* api.customers.getOne(data.id);
        })
      )
  );

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

const UpdateRoleSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  role: Schema.Literal("CUSTOMER", "ADMIN", "FINANCE"),
});

// ── GET /admin/users — paginated list with optional search ────────────────

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

// ── GET /admin/users/:id — single customer ────────────────────────────────

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

// ── PATCH /admin/users/:id/role — update role (OWNER only) ────────────────

export const updateCustomerRoleFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      UpdateRoleSchema,
      raw as Schema.Schema.Encoded<typeof UpdateRoleSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.customers.updateRole(data.id, data.role);
      })
    )
  );

// ── DELETE /admin/users/:id — soft-delete (OWNER only) ────────────────────

export const deleteCustomerFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      CustomerIdSchema,
      raw as Schema.Schema.Encoded<typeof CustomerIdSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.customers.delete(data.id);
      })
    )
  );

// ── PATCH /admin/users/:id/restore — restore soft-deleted (OWNER only) ────

export const restoreCustomerFn = createServerFn({ method: "POST" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      CustomerIdSchema,
      raw as Schema.Schema.Encoded<typeof CustomerIdSchema>
    )
  )
  .handler(async ({ data, context }) =>
    context.runtime.runPromise(
      Effect.gen(function* () {
        const api = yield* ApiClientService;
        return yield* api.customers.restore(data.id);
      })
    )
  );

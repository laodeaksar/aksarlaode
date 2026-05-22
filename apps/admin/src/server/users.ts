import { createServerFn } from "@tanstack/react-start";

import { Effect, Schema } from "effect";

import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";
import type { User } from "@/effect/Services";

import { decodeOrThrow } from "./_utils";

// ── Input schemas ──────────────────────────────────────────────────────────

const ListAdminUsersParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  search: Schema.optional(Schema.String),
});

// ── GET /admin/users?role=ADMIN&role=FINANCE&role=OWNER ─────────────────────
// Restricted to users:manage (OWNER only).

export const listAdminUsersFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("users:manage")])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ListAdminUsersParamsSchema,
      raw as Schema.Schema.Encoded<typeof ListAdminUsersParamsSchema>
    )
  )
  .handler(
    async ({ data, context }): Promise<{ items: User[]; total: number }> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          const params: { page: number; search?: string } = {
            page: data.page,
          };
          if (data.search !== undefined) params.search = data.search;
          return yield* api.adminUsers.list(params);
        })
      )
  );

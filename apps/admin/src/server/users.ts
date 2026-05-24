import { createServerFn } from "@tanstack/react-start";

import { Effect, Schema } from "effect";

import { auditMiddleware } from "@/effect/AuditMiddleware";
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

// ── POST /admin/invite — create staff account + send invite email ──────────

const InviteUserSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.minLength(1)),
  role: Schema.Literal("ADMIN", "FINANCE"),
  name: Schema.optional(Schema.String),
});

export const inviteUserFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("users:manage"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      InviteUserSchema,
      raw as Schema.Schema.Encoded<typeof InviteUserSchema>
    )
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      message: string;
      userId: string;
      email: string;
      role: string;
    }> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          return yield* api.adminUsers.invite(data);
        })
      )
  );

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

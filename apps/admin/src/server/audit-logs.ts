import { createServerFn } from "@tanstack/react-start";

import { Effect, Schema } from "effect";

import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";
import type { AuditLogEntry } from "@/effect/Services";

import { decodeOrThrow } from "./_utils";

// ── Input schema ───────────────────────────────────────────────────────────

const ListAuditLogsParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
  // ISO date strings YYYY-MM-DD, forwarded as-is to the backend query string.
  startDate: Schema.optional(Schema.String),
  endDate: Schema.optional(Schema.String),
  // AuditAction value (e.g. "product_deleted") or omitted for "all actions".
  action: Schema.optional(Schema.String),
  // UserRole value (e.g. "ADMIN") or omitted for "all roles".
  actorRole: Schema.optional(Schema.String),
});

export type ListAuditLogsParams = Schema.Schema.Type<
  typeof ListAuditLogsParamsSchema
>;

// ── GET /products/audit-logs — paginated audit log with optional filters ───
// Used as the SSR loader in `routes/audit-logs/route.tsx` and re-called by
// `useQuery` whenever the user changes any filter or navigates to a new page.

export const listAuditLogsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ListAuditLogsParamsSchema,
      raw as Schema.Schema.Encoded<typeof ListAuditLogsParamsSchema>
    )
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      items: AuditLogEntry[];
      total: number;
      page: number;
      limit: number;
    }> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          return yield* api.auditLogs.list({
            page: data.page,
            startDate: data.startDate,
            endDate: data.endDate,
            action: data.action,
            actorRole: data.actorRole,
          });
        })
      )
  );

import { createServerFn }  from "@tanstack/react-start"
import { Effect, Schema }  from "effect"
import { ApiClientService } from "@/effect/Services"
import type { AuditLogEntry } from "@/effect/Services"
import { effectMiddleware } from "@/effect/Middleware"
import { decodeOrThrow }   from "./_utils"

// ── Input schema ───────────────────────────────────────────────────────────

const ListAuditLogsParamsSchema = Schema.Struct({
  page: Schema.optionalWith(Schema.NumberFromString, { default: () => 1 }),
})

// ── GET /products/audit-logs — paginated audit log ─────────────────────────
// Used as the SSR loader in `routes/audit-logs/index.tsx`.

export const listAuditLogsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      ListAuditLogsParamsSchema,
      raw as Schema.Schema.Encoded<typeof ListAuditLogsParamsSchema>,
    )
  )
  .handler(
    async ({ data, context }): Promise<{
      items: AuditLogEntry[]
      total: number
      page:  number
      limit: number
    }> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService
          return yield* api.auditLogs.list(data.page)
        }),
      )
  )

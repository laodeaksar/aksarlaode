// FIX ADM-06b: Utility for writing immutable audit entries to admin_audit_log.
// Uses fire-and-forget (Effect.runPromise without await) so audit failures
// never abort the primary operation.
import { Effect } from "effect"

import { db, schema } from "@repo/database"
import type { NewAdminAuditLog } from "@repo/database"

export function writeAuditLog(
  entry: Omit<NewAdminAuditLog, "id" | "createdAt">
): void {
  const id = crypto.randomUUID()

  Effect.runPromise(
    Effect.tryPromise({
      try: () => db.insert(schema.adminAuditLog).values({ ...entry, id }),
      catch: (e) => {
        console.error(
          JSON.stringify({ event: "audit_log_write_failed", error: String(e) })
        )
        return e
      },
    })
  ).catch(() => {
    /* already logged above */
  })
}

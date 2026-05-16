// FIX ADM-06b: Exposes a read endpoint for the admin_audit_log table.
// Only ADMIN or OWNER roles may access this endpoint; FINANCE is read-only
// by design and doesn't need direct audit access via this service route.
import type { Context } from "elysia"
import { db, schema }   from "@repo/database"
import { desc, eq, and, gte, sql } from "drizzle-orm"
import type { DerivedContext } from "@/types"

const PAGE_SIZE = 50

export const auditLogHandler = async ({ query, set, userRole }: Context & DerivedContext) => {
  if (userRole !== "ADMIN" && userRole !== "OWNER") {
    set.status = 403
    return { error: "Forbidden: ADMIN or OWNER role required", code: "FORBIDDEN" }
  }

  const page   = Math.max(1, Number(query.page ?? 1))
  const action = query.action as string | undefined
  const since  = query.since  as string | undefined   // ISO datetime

  const conditions = []
  if (action) conditions.push(eq(schema.adminAuditLog.action, action))
  if (since)  conditions.push(gte(schema.adminAuditLog.createdAt, new Date(since)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db.select()
      .from(schema.adminAuditLog)
      .where(where)
      .orderBy(desc(schema.adminAuditLog.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` })
      .from(schema.adminAuditLog)
      .where(where),
  ])

  return {
    items: rows,
    total: Number(count),
    page,
    limit: PAGE_SIZE,
  }
}

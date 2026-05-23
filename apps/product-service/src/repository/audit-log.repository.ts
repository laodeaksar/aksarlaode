import { Data, Effect } from "effect";

import { and, db, desc, eq, gte, schema, sql } from "@repo/database";

// ── Error types ────────────────────────────────────────────────────────────
export class DbError extends Data.TaggedError("AuditLogDbError")<{
  cause: unknown;
}> {}

// ── Filter type ────────────────────────────────────────────────────────────
export type AuditLogFilters = {
  page?: number | undefined;
  action?: string | undefined;
  since?: string | undefined; // ISO datetime string
  actorRole?: string | undefined;
};

export const AUDIT_LOG_PAGE_SIZE = 50;

// ── list ───────────────────────────────────────────────────────────────────
const list = (filters: AuditLogFilters) =>
  Effect.tryPromise({
    try: async () => {
      const page = Math.max(1, filters.page ?? 1);
      const conditions = [];

      if (filters.action)
        conditions.push(eq(schema.adminAuditLog.action, filters.action));
      if (filters.actorRole)
        conditions.push(
          eq(schema.adminAuditLog.actorRole, filters.actorRole)
        );
      if (filters.since)
        conditions.push(
          gte(schema.adminAuditLog.createdAt, new Date(filters.since))
        );

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(schema.adminAuditLog)
          .where(where)
          .orderBy(desc(schema.adminAuditLog.createdAt))
          .limit(AUDIT_LOG_PAGE_SIZE)
          .offset((page - 1) * AUDIT_LOG_PAGE_SIZE),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.adminAuditLog)
          .where(where),
      ]);

      return {
        items: rows,
        total: Number(countResult[0]?.count ?? 0),
        page,
        limit: AUDIT_LOG_PAGE_SIZE,
      };
    },
    catch: (e) => new DbError({ cause: e }),
  });

// ── Exports ────────────────────────────────────────────────────────────────
export const auditLogRepository = { list };

// ── Write audit log entry (admin → product-service) ───────────────────────
// Called by the admin app's auditMiddleware via POST /products/audit-logs.
// The product-service is the single source of truth for admin_audit_log writes
// so all entries go through writeAuditLog() which uses the shared Drizzle client.
//
// Auth model:
//   • Requires a valid x-service-token (checked by index.ts for all routes).
//   • actorRole in the body must be ADMIN, OWNER, or FINANCE — the same roles
//     that can log into the admin panel (see apps/admin/src/lib/rbac.ts).
//
// The response is 202 Accepted; the actual DB insert is fire-and-forget inside
// writeAuditLog() so the admin app never blocks on audit persistence.

import type { Context } from "elysia";

import { writeAuditLog } from "@/lib/admin-audit";
import type { DerivedContext } from "@/types";

// ── Body type (mirrors NewAdminAuditLog without id / createdAt) ───────────

export type WriteAuditLogBody = {
  actorId: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

const ALLOWED_ROLES = new Set(["ADMIN", "OWNER", "FINANCE"]);

export const writeAuditLogHandler = async ({
  body,
  set,
}: Context & DerivedContext & { body: WriteAuditLogBody }) => {
  if (!ALLOWED_ROLES.has(body.actorRole)) {
    set.status = 403;
    return {
      error: "Forbidden: actorRole must be ADMIN, OWNER, or FINANCE",
      code: "FORBIDDEN",
    };
  }

  writeAuditLog({
    actorId: body.actorId,
    actorRole: body.actorRole,
    action: body.action,
    resource: body.resource,
    resourceId: body.resourceId,
    oldValue: body.oldValue ?? undefined,
    newValue: body.newValue ?? undefined,
    metadata: body.metadata ?? undefined,
  });

  set.status = 202;
  return { message: "Accepted" };
};

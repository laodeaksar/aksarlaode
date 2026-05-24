// FIX ADM-06b: Exposes a read endpoint for the admin_audit_log table.
// Only ADMIN or OWNER roles may access this endpoint; FINANCE is read-only
// by design and doesn't need direct audit access via this service route.
import { Effect } from "effect";

import type { Context } from "elysia";

import { auditLogRepository } from "@/repository/audit-log.repository";
import type { DerivedContext } from "@/types";

export const auditLogHandler = async ({
  query,
  set,
  userRole,
}: Context & DerivedContext) => {
  if (userRole !== "ADMIN" && userRole !== "OWNER") {
    set.status = 403;
    return {
      error: "Forbidden: ADMIN or OWNER role required",
      code: "FORBIDDEN",
    };
  }

  const result = await Effect.runPromiseExit(
    auditLogRepository.list({
      page: query.page ? Number(query.page) : undefined,
      action: query.action as string | undefined,
      actorRole: query.actorRole as string | undefined,
      since: query.since as string | undefined,
    })
  );

  if (result._tag === "Failure") {
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  }

  return result.value;
};

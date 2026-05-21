// ── auditMiddleware — structured domain audit trail ────────────────────────
//
// Records every mutating (POST) TanStack Start server function call into the
// admin_audit_log table via POST /products/audit-logs.
//
// Usage — add to mutating server functions AFTER effectMiddleware and
//         requirePermission (so only authorized calls are audited):
//
//   export const deleteProductFn = createServerFn({ method: "POST" })
//     .middleware([effectMiddleware, requirePermission("products:write"), auditMiddleware])
//     .inputValidator(...)
//     .handler(...)
//
// What this middleware does:
//
//   1. Looks up the server function name in SERVER_FN_ACTION_MAP.
//      If no mapping exists the middleware is a no-op (passes through).
//
//   2. Resolves the current admin session — prefers the `adminSession` already
//      placed in context by requirePermission (no extra HTTP call); falls back
//      to resolveAdminSession when the middleware runs without requirePermission.
//
//   3. Awaits next() — the actual handler runs here.
//
//   4. On success:  fires writeAuditEntry with outcome "ok".
//   5. On any throw: fires writeAuditEntry with outcome "error", then re-throws.
//
//   In both cases the audit write is fire-and-forget: a failure to reach
//   the product service never aborts the primary operation.

import { createMiddleware } from "@tanstack/react-start";

import { env } from "@repo/env/admin";

import type { Session } from "@/lib/auth";

import { resolveAdminSession } from "./AuthMiddleware";
import {
  extractResourceId,
  fireAuditWrite,
  sanitizeInput,
  SERVER_FN_ACTION_MAP,
} from "./Audit";

// ── Middleware ─────────────────────────────────────────────────────────────

export const auditMiddleware = createMiddleware().server(
  async (ctx) => {
    const { next, serverFnMeta } = ctx;
    // `data` exists at runtime but is typed as `undefined` in the generic
    // since this middleware has no `.validator()` — access via cast.
    const data = (
      ctx as unknown as { data: Record<string, unknown> }
    ).data ?? {};

    const fnName = serverFnMeta?.name ?? "";
    const mapping = SERVER_FN_ACTION_MAP[fnName];

    // Not a mapped mutating function — pass through unchanged.
    if (!mapping) return next();

    const apiUrl = env.PUBLIC_API_URL;
    const internalToken = env.INTERNAL_SERVICE_TOKEN;

    // Prefer session already resolved by requirePermission (avoids a second
    // HTTP call to /auth/me). Fall back to fresh resolution when running
    // without the auth middleware (e.g. in test environments).
    const ctxWithSession = ctx as unknown as {
      context?: { adminSession?: Session };
    };
    const session =
      ctxWithSession.context?.adminSession ??
      (await resolveAdminSession(apiUrl));

    const actorId = session?.id ?? "unknown";
    // Use "unknown" — not "ADMIN" — when the session cannot be resolved
    // so the audit trail does not falsely attribute actions to a privileged role.
    const actorRole = session?.role ?? "unknown";

    const startMs = performance.now();

    // ── Happy path ──────────────────────────────────────────────────────
    try {
      const result = await next();

      fireAuditWrite(apiUrl, internalToken, {
        actorId,
        actorRole,
        action: mapping.action,
        resource: mapping.resource,
        resourceId: extractResourceId(fnName, data, result),
        metadata: {
          fn: fnName,
          file: serverFnMeta?.filename ?? "(unknown)",
          durationMs: Math.round(performance.now() - startMs),
          outcome: "ok",
          input: sanitizeInput(data),
        },
      });

      return result;

      // ── Error path ──────────────────────────────────────────────────────
    } catch (err: unknown) {
      fireAuditWrite(apiUrl, internalToken, {
        actorId,
        actorRole,
        action: mapping.action,
        resource: mapping.resource,
        resourceId: extractResourceId(fnName, data),
        metadata: {
          fn: fnName,
          file: serverFnMeta?.filename ?? "(unknown)",
          durationMs: Math.round(performance.now() - startMs),
          outcome: "error",
          input: sanitizeInput(data),
          error: serializeErr(err),
        },
      });

      throw err;
    }
  }
);

// ── Error serialisation ─────────────────────────────────────────────────────
// Produces a compact, JSON-safe representation of any thrown value.

function serializeErr(err: unknown): Record<string, unknown> {
  if (err === null || typeof err !== "object") return { message: String(err) };

  const e = err as Record<string, unknown>;
  return {
    _tag: typeof e["_tag"] === "string" ? e["_tag"] : "UnknownError",
    message:
      typeof e["message"] === "string" ? e["message"] : JSON.stringify(err),
    ...(typeof e["status"] === "number" ? { status: e["status"] } : {}),
  };
}

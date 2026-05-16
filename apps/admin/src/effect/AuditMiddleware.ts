// ── auditMiddleware — structured domain audit trail ────────────────────────
//
// Records every mutating (POST) TanStack Start server function call into the
// admin_audit_log table via POST /products/audit-logs.
//
// Usage — add to mutating server functions AFTER effectMiddleware:
//
//   export const deleteProductFn = createServerFn({ method: "POST" })
//     .middleware([effectMiddleware, auditMiddleware])
//     .inputValidator(...)
//     .handler(...)
//
// What this middleware does:
//
//   1. Looks up the server function name in SERVER_FN_ACTION_MAP.
//      If no mapping exists the middleware is a no-op (passes through).
//
//   2. Resolves the current admin session by forwarding the request cookies
//      to GET /auth/me — the same endpoint the client uses after login.
//
//   3. Awaits next() — the actual handler runs here.
//
//   4. On success:  fires writeAuditEntry with outcome "ok" and the
//      resource ID taken from the handler result (for creates) or the
//      input data (for updates / deletes).
//
//   5. On any throw: fires writeAuditEntry with outcome "error" and a
//      serialised error payload, then re-throws so TanStack Start can
//      return the correct HTTP status to the client.
//
//   In both cases the audit write is fire-and-forget: a failure to reach
//   the product service never aborts the primary operation.

import { createMiddleware } from "@tanstack/react-start"
import { getCookies }       from "@tanstack/react-start/server"
import type { Session }     from "@/lib/auth"
import {
  SERVER_FN_ACTION_MAP,
  sanitizeInput,
  extractResourceId,
  fireAuditWrite,
} from "./Audit"

// ── Session resolution ─────────────────────────────────────────────────────
// Forward the request cookies to the backend's /auth/me endpoint to obtain
// the same session object the client sees. Returns null if unauthenticated
// or if the auth service is unreachable.

async function resolveSession(apiUrl: string): Promise<Session | null> {
  try {
    const cookies = getCookies()
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("; ")

    if (!cookieHeader) return null

    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Cookie: cookieHeader },
    })

    if (!res.ok) return null

    const body = await res.json() as unknown
    const data  = (body as { data?: Session } | null)?.data ?? (body as Session | null)
    return data ?? null
  } catch {
    return null
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────

export const auditMiddleware = createMiddleware().server(
  async ({ next, serverFnMeta, data }) => {
    const fnName  = serverFnMeta?.name ?? ""
    const mapping = SERVER_FN_ACTION_MAP[fnName]

    // Not a mapped mutating function — pass through unchanged.
    if (!mapping) return next()

    // Resolve environment config from process.env (server-only).
    const apiUrl        = process.env["PUBLIC_API_URL"]          ?? "http://localhost:3000"
    const internalToken = process.env["INTERNAL_SERVICE_TOKEN"]  ?? ""

    // Attempt session resolution — if it fails we still run the handler
    // but write the audit entry with a "system" fallback actor.
    const session = await resolveSession(apiUrl)
    const actorId   = session?.id   ?? "system"
    const actorRole = session?.role ?? "ADMIN"

    const startMs = performance.now()

    // ── Happy path ──────────────────────────────────────────────────────
    try {
      const result = await next()

      fireAuditWrite(apiUrl, internalToken, {
        actorId,
        actorRole,
        action:     mapping.action,
        resource:   mapping.resource,
        resourceId: extractResourceId(fnName, data, result),
        metadata: {
          fn:         fnName,
          file:       serverFnMeta?.filename ?? "(unknown)",
          durationMs: Math.round(performance.now() - startMs),
          outcome:    "ok",
          input:      sanitizeInput(data),
        },
      })

      return result

    // ── Error path ──────────────────────────────────────────────────────
    } catch (err: unknown) {
      fireAuditWrite(apiUrl, internalToken, {
        actorId,
        actorRole,
        action:     mapping.action,
        resource:   mapping.resource,
        resourceId: extractResourceId(fnName, data),
        metadata: {
          fn:         fnName,
          file:       serverFnMeta?.filename ?? "(unknown)",
          durationMs: Math.round(performance.now() - startMs),
          outcome:    "error",
          input:      sanitizeInput(data),
          error:      serializeErr(err),
        },
      })

      throw err
    }
  },
)

// ── Error serialisation ─────────────────────────────────────────────────────
// Produces a compact, JSON-safe representation of any thrown value.

function serializeErr(err: unknown): Record<string, unknown> {
  if (err === null || typeof err !== "object") return { message: String(err) }

  const e = err as Record<string, unknown>
  return {
    _tag:    typeof e["_tag"]    === "string" ? e["_tag"]    : "UnknownError",
    message: typeof e["message"] === "string" ? e["message"] : JSON.stringify(err),
    ...(typeof e["status"] === "number" ? { status: e["status"] } : {}),
  }
}

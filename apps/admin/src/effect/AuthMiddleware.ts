// ── AuthMiddleware — server-side RBAC enforcement ──────────────────────────
//
// Adds authorization checking to TanStack Start server functions.
// Must be added to EVERY server function that performs a state-changing
// operation — do not rely on client-side `can()` checks in `beforeLoad`
// as those are purely a UI gate and can be bypassed by direct HTTP calls.
//
// Usage — place AFTER effectMiddleware, BEFORE auditMiddleware:
//
//   export const deleteProductFn = createServerFn({ method: "POST" })
//     .middleware([
//       effectMiddleware,
//       requirePermission("products:write"),  // ← server-side guard
//       auditMiddleware,
//     ])
//     .inputValidator(...)
//     .handler(...)
//
// What this middleware does:
//
//   1. Reads the request cookies via getCookies() and builds a Cookie header.
//   2. Calls GET /auth/me to resolve the current session.
//   3. Throws UnauthorizedError (HTTP 401) when no valid session is found.
//   4. Throws UnauthorizedError (HTTP 403) when the session's role lacks
//      the required permission according to the shared RBAC table.
//   5. On success, forwards `adminSession` in context so downstream
//      middleware (e.g. auditMiddleware) can read it without a second
//      HTTP call to the auth service.

import { createMiddleware } from "@tanstack/react-start";
import { getCookies } from "@tanstack/react-start/server";

import { Schema } from "effect";

import type { Session } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";

import { UnauthorizedError } from "./Errors";

// Minimal Effect Schema for session validation inside this middleware.
// Keeps AuthMiddleware self-contained and avoids importing from server/auth.ts
// (which would create an effect/ → server/ dependency inversion).
// Full schema validation (including name field) lives in server/auth.ts.
const MinimalSessionSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.minLength(1)),
  role: Schema.Literal("CUSTOMER", "ADMIN", "OWNER", "FINANCE"),
});

// ── Session resolution ──────────────────────────────────────────────────────
// Exported so auditMiddleware can import and reuse this instead of
// duplicating its own resolveSession function.
// Returns null on any network error, non-OK response, or invalid payload
// — never throws.

export async function resolveAdminSession(
  apiUrl: string
): Promise<Session | null> {
  try {
    const cookies = getCookies();
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("; ");

    if (!cookieHeader) return null;

    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) return null;

    const body = (await res.json()) as unknown;
    const raw = (body as { data?: unknown } | null)?.data ?? (body as unknown);

    // Validate the session shape with Effect Schema before trusting it.
    // This prevents silent type confusion if the auth service returns
    // an unexpected payload or the Session interface gains required fields.
    const parsed = Schema.decodeUnknownEither(MinimalSessionSchema)(raw);
    if (parsed._tag === "Left") return null;

    // Cast is safe: MinimalSessionSchema covers all fields required for authz.
    // The full Session type (including `name`) is validated in getSessionFn.
    return parsed.right as unknown as Session;
  } catch {
    return null;
  }
}

// ── Context augmentation ────────────────────────────────────────────────────
// Downstream middleware / handlers can read the resolved session via
// `context.adminSession` after this middleware runs successfully.

export type AuthMiddlewareContext = {
  adminSession: Session;
};

// ── requirePermission ───────────────────────────────────────────────────────

const apiUrl = () => process.env["PUBLIC_API_URL"] ?? "http://localhost:3000";

/**
 * Factory that returns a server-only TanStack Start middleware enforcing
 * a single permission from the shared RBAC table.
 *
 * Throws `UnauthorizedError` (serialised as a 401/403-equivalent by TanStack
 * Start) when the session is missing or the role lacks the permission.
 * The router.tsx `is401` helper already detects `UnauthorizedError` and
 * triggers the silent-refresh / redirect-to-login flow.
 */
export function requirePermission(permission: Permission) {
  return createMiddleware().server(async ({ next }) => {
    const session = await resolveAdminSession(apiUrl());

    if (!session) {
      throw new UnauthorizedError({
        reason: "No valid admin session. Please log in again.",
      });
    }

    if (!can(session.role, permission)) {
      throw new UnauthorizedError({
        reason: `Role "${session.role}" does not have permission "${permission}".`,
      });
    }

    return next({
      context: { adminSession: session } satisfies AuthMiddlewareContext,
    });
  });
}

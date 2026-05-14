import Elysia from "elysia"
import type { UserRole } from "@/types"

/**
 * Parses the forwarded user headers set by the API gateway after JWT verification.
 *
 * Headers injected by the gateway:
 *   x-user-id    — authenticated user's UUID (absent on public/anonymous requests)
 *   x-user-role  — "CUSTOMER" | "ADMIN"
 *   x-request-id — trace ID for correlating logs across services
 *
 * Usage in any handler:
 *   ({ userId, userRole, requestId }) => { ... }
 */
export const withUserContext = new Elysia({ name: "user-context" })
  .derive({ as: "global" }, ({ headers }) => ({
    userId:    headers["x-user-id"]                        ?? null,
    userRole: (headers["x-user-role"] as UserRole | undefined) ?? null,
    requestId: headers["x-request-id"]                    ?? null,
  }))

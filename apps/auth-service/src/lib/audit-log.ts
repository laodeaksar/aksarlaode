/**
 * Structured audit log for security-relevant auth events.
 *
 * Emits JSON to stdout so it can be picked up by any log aggregator
 * (CloudWatch, Datadog, Loki, etc.) without a separate dependency.
 *
 * Format:
 * {
 *   "audit":     true,
 *   "event":     "LOGIN_SUCCESS",
 *   "actorId":   "uuid-of-acting-user",
 *   "targetId":  "uuid-of-affected-user",
 *   "timestamp": "2024-05-13T10:00:00.000Z",
 *   ...extraMeta
 * }
 */

export type AuditEventName =
  // ── Privileged account actions ───────────────────────────────────────────
  | "OWNER_TRANSFER" // ownership transferred to another user
  | "ROLE_CHANGE" // any role mutation or user deletion
  | "OWNER_LOGIN" // OWNER authenticated successfully (kept for back-compat)
  // ── Account lifecycle ────────────────────────────────────────────────────
  | "ACCOUNT_CREATED" // new user account successfully registered
  // ── Session lifecycle ────────────────────────────────────────────────────
  | "LOGIN_SUCCESS" // any user authenticated successfully
  | "LOGIN_FAILED" // authentication attempt rejected (bad credentials)
  | "LOGOUT" // user explicitly logged out
  | "SESSION_REVOKED" // a specific session was revoked via the sessions API
  // ── Credential changes ───────────────────────────────────────────────────
  | "PASSWORD_CHANGED" // password changed via change-password endpoint
  | "PASSWORD_RESET" // password reset via forgot/reset-password flow

export type AuditEntry = {
  event: AuditEventName
  actorId: string
  targetId: string
  meta?: Record<string, string>
}

export const writeAuditLog = ({
  event,
  actorId,
  targetId,
  meta = {},
}: AuditEntry): void => {
  const entry = {
    audit: true,
    event,
    actorId,
    targetId,
    ...meta,
    timestamp: new Date().toISOString(),
  }
  // Use process.stdout.write to bypass any request-logger interception
  process.stdout.write(JSON.stringify(entry) + "\n")
}

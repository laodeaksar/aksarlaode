/**
 * Structured audit log for privileged OWNER actions.
 *
 * Emits JSON to stdout so it can be picked up by any log aggregator
 * (CloudWatch, Datadog, Loki, etc.) without a separate dependency.
 *
 * Format:
 * {
 *   "audit":     true,
 *   "event":     "OWNER_TRANSFER",
 *   "actorId":   "uuid-of-acting-user",
 *   "targetId":  "uuid-of-affected-user",
 *   "timestamp": "2024-05-13T10:00:00.000Z",
 *   ...extraMeta
 * }
 */

export type AuditEventName =
  | "OWNER_TRANSFER"   // ownership transferred to another user
  | "ROLE_CHANGE"      // any role mutation
  | "OWNER_LOGIN"      // OWNER authenticated successfully

export type AuditEntry = {
  event:    AuditEventName
  actorId:  string
  targetId: string
  meta?:    Record<string, string>
}

export const writeAuditLog = ({ event, actorId, targetId, meta = {} }: AuditEntry): void => {
  const entry = {
    audit:     true,
    event,
    actorId,
    targetId,
    ...meta,
    timestamp: new Date().toISOString(),
  }
  // Use process.stdout.write to bypass any request-logger interception
  process.stdout.write(JSON.stringify(entry) + "\n")
}

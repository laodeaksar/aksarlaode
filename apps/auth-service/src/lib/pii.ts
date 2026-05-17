/**
 * PII masking utilities for structured logs.
 *
 * Audit logs are shipped to external aggregators (Datadog, CloudWatch, etc.)
 * and may be accessible to team members who should not see raw PII.
 * Under GDPR / PDPA, storing plaintext email addresses in log sinks that
 * have broad read access constitutes unnecessary data processing.
 *
 * Rules:
 *  - Preserve enough structure to correlate "same email" events across log lines.
 *  - Never store a reversible representation.
 *  - Fast, synchronous — audit logging must not block the request path.
 */

/**
 * Masks an email address for safe inclusion in logs.
 *
 * Input:  "john.doe@example.com"
 * Output: "j***@example.com"
 *
 * The first character of the local part and the full domain are preserved
 * so that an operator can correlate multiple events for the same email
 * without seeing the full address.
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@")
  if (atIndex <= 0) return "***@***"

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  const visiblePrefix = local[0] ?? "*"
  const starCount = Math.min(Math.max(local.length - 1, 1), 4)

  return `${visiblePrefix}${"*".repeat(starCount)}@${domain}`
}

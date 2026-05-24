// ── Admin audit log types and helpers ─────────────────────────────────────
//
// These are the canonical types used by auditMiddleware when constructing
// entries before sending them to POST /products/audit-logs.

import { logWarn } from "./Logger";

// ── Domain action catalogue ────────────────────────────────────────────────
// Maps TanStack Start server function names to (action, resource) pairs that
// appear in the admin_audit_log table.
//
// Convention: action = "<resource>_<past-tense-verb>", resource = entity name.
// Add a new entry whenever a mutating server function is created.

export type AuditAction =
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "order_status_changed"
  | "user_role_changed"
  | "user_invited"
  | "customer_deleted"
  | "customer_restored"
  | "settings_updated"
  | "queue_job_retried" // single failed job manually retried
  | "queue_jobs_retried" // all failed jobs retried at once
  | "queue_email_resent"; // one-off email manually enqueued from admin

export type AuditResource = "product" | "order" | "user" | "settings" | "queue";

export type ActionMapping = {
  action: AuditAction;
  resource: AuditResource;
};

export const SERVER_FN_ACTION_MAP: Readonly<Record<string, ActionMapping>> = {
  createProductFn: { action: "product_created", resource: "product" },
  updateProductFn: { action: "product_updated", resource: "product" },
  deleteProductFn: { action: "product_deleted", resource: "product" },
  updateOrderStatusFn: { action: "order_status_changed", resource: "order" },
  changeUserRoleFn: { action: "user_role_changed", resource: "user" },
  inviteUserFn: { action: "user_invited", resource: "user" },
  deleteCustomerFn: { action: "customer_deleted", resource: "user" },
  restoreCustomerFn: { action: "customer_restored", resource: "user" },
  updateSettingsFn: { action: "settings_updated", resource: "settings" },
  // ── Queue dashboard actions ───────────────────────────────────────────────
  retryJobFn: { action: "queue_job_retried", resource: "queue" },
  retryAllFn: { action: "queue_jobs_retried", resource: "queue" },
  resendEmailFn: { action: "queue_email_resent", resource: "queue" },
};

// ── Audit entry input ──────────────────────────────────────────────────────

export type AuditEntryInput = {
  actorId: string;
  actorRole: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

// ── Input sanitization ─────────────────────────────────────────────────────

const SENSITIVE_KEY_RE = /^(password|token|secret|key|auth|cvv|cvc|pin|card)/i;
const MAX_STRING_LEN = 200;
const MAX_ARRAY_ITEMS = 10;

export function sanitizeInput(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null) return null;
  if (typeof value !== "object" && typeof value !== "bigint") {
    if (typeof value === "string" && value.length > MAX_STRING_LEN) {
      return value.slice(0, MAX_STRING_LEN) + "…";
    }
    return value;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((v) => sanitizeInput(v, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `…+${value.length - MAX_ARRAY_ITEMS} more`]
      : items;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY_RE.test(k)
      ? "[REDACTED]"
      : sanitizeInput(v, depth + 1);
  }
  return out;
}

// ── Resource-ID extraction ─────────────────────────────────────────────────
// Pulls the affected entity's ID from the server function input or result.

export function extractResourceId(
  fnName: string,
  data: unknown,
  result: unknown = undefined
): string {
  // Settings always affect the single global row.
  if (fnName === "updateSettingsFn") return "global";

  // Retry-all acts on the entire failed set — no single resource ID.
  if (fnName === "retryAllFn") return "all";

  // For creates and invites, prefer the ID from the returned payload.
  if (
    (fnName.startsWith("create") || fnName.startsWith("invite")) &&
    result !== null &&
    typeof result === "object"
  ) {
    const r = result as Record<string, unknown>;
    if (typeof r["id"] === "string") return r["id"];
    if (typeof r["userId"] === "string") return r["userId"];
  }

  if (data !== null && typeof data === "object") {
    const d = data as Record<string, unknown>;
    // Standard ID field used by most server functions.
    if (typeof d["id"] === "string") return d["id"];
    if (typeof d["resourceId"] === "string") return d["resourceId"];
    // Queue-specific: retryJobFn passes jobId; resendEmailFn passes orderId.
    if (typeof d["jobId"] === "string") return d["jobId"];
    if (typeof d["orderId"] === "string") return d["orderId"];
  }

  return "(unknown)";
}

// ── Fire-and-forget write ──────────────────────────────────────────────────
// Sends the audit entry to the product service write endpoint.
// NEVER throws — failures are logged to stderr but never propagate.

export function fireAuditWrite(
  apiUrl: string,
  internalToken: string,
  entry: AuditEntryInput
): void {
  const body = JSON.stringify(entry);

  fetch(`${apiUrl}/products/audit-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-token": internalToken,
      "x-user-id": entry.actorId,
      "x-user-role": entry.actorRole,
    },
    body,
  })
    .then((res) => {
      if (!res.ok) {
        logWarn({
          event: "audit_write_http_error",
          status: res.status,
          fn: entry.metadata?.["fn"] as string | undefined,
        });
      }
    })
    .catch((err: unknown) => {
      logWarn({
        event: "audit_write_network_error",
        message: err instanceof Error ? err.message : String(err),
        fn: entry.metadata?.["fn"] as string | undefined,
      });
    });
}

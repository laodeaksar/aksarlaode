import type { MiddlewareHandler } from "hono";

import { getClientIp } from "@/lib/client-ip";
import type { AppEnv } from "@/types/context";

// ── Sanitization ──────────────────────────────────────────────────────────────
// Any object key matching this pattern has its value replaced with "[REDACTED]".
// Catches: password, passwordHash, token, accessToken, refreshToken, secret,
//          secretKey, apiKey, authorization, x-service-token, cvv, cardNumber, pin…
const SENSITIVE_KEY_RE = /^(password|token|secret|key|auth|cvv|cvc|pin|card)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null) return null;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    const items = value.slice(0, 20).map((v) => sanitize(v, depth + 1));
    return value.length > 20
      ? [...items, `…+${value.length - 20} more`]
      : items;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : sanitize(v, depth + 1);
  }
  return out;
}

function sanitizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    out[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : v;
  });
  return out;
}

// ── Body parsing ──────────────────────────────────────────────────────────────
// Clone the request so the original stream stays intact for the proxy layer.
async function readSanitizedBody(req: Request): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined;

  try {
    const text = await req.clone().text();
    if (!text.trim()) return undefined;
    return sanitize(JSON.parse(text));
  } catch {
    return "[unparseable]";
  }
}

// ── Route filtering ───────────────────────────────────────────────────────────
// Skip noisy internal paths that add no compliance value.
const SKIP_PATHS = new Set(["/health"]);

// Only capture bodies for write operations — GETs carry no meaningful payload.
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

// ── Middleware ────────────────────────────────────────────────────────────────
// Placed after contextInjector (so c.var.user is populated) and before
// routeGuard (so RBAC rejections are also recorded).
export const auditLog: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (SKIP_PATHS.has(c.req.path)) return next();

  const startMs = Date.now();

  // Capture the sanitized request body BEFORE calling next() — proxy.ts will
  // consume c.req.raw, but our clone is independent.
  const body = BODY_METHODS.has(c.req.method)
    ? await readSanitizedBody(c.req.raw)
    : undefined;

  // Sanitize query params
  const url = new URL(c.req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = SENSITIVE_KEY_RE.test(k) ? "[REDACTED]" : v;
  });

  await next();

  // ── Write audit entry after response is ready ─────────────────────────────
  const user = c.var.user;

  const entry = {
    event: "audit",
    ts: new Date().toISOString(),
    requestId: c.var.requestId,

    // Request
    method: c.req.method,
    path: c.req.path,
    query: Object.keys(query).length > 0 ? query : undefined,
    body,

    // Response
    status: c.res.status,
    duration: Date.now() - startMs,

    // Identity — available after contextInjector sets c.var.user
    userId: user?.id ?? null,
    role: user?.role ?? null,
    sessionId: user?.sessionId ?? null,

    // Client
    ip: getClientIp(c), // C-05
    ua: c.req.header("user-agent") ?? null,
  };

  // Write on a dedicated line to stdout using a distinct event name.
  // In production, configure your log forwarder (Filebeat, Fluent Bit, Vector)
  // to route lines with `"event":"audit"` to a separate index or stream.
  process.stdout.write(JSON.stringify(entry) + "\n");
};

import type { Context } from "hono";

import type { AppEnv } from "@/types/context";

/**
 * Returns the best-effort client IP address.
 *
 * Priority:
 *   1. cf-connecting-ip  — set by Cloudflare, trusted if behind CF
 *   2. x-forwarded-for   — first IP in the chain (closest to client)
 *   3. x-real-ip         — set by nginx / other reverse proxies
 *   4. "unknown"         — fallback for local dev / direct connections
 *
 * Always `.split(",")[0].trim()` on x-forwarded-for because the header may
 * contain a comma-separated list when passing through multiple proxies.
 *
 * Single source of truth — replaces five diverging inline implementations
 * across logger, rate-limiter, audit-log, idempotency, and proxy.
 */
export function getClientIp(c: Context<AppEnv>): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

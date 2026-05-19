import type { MiddlewareHandler } from "hono";

import { getClientIp } from "@/lib/client-ip";
import { getRedis } from "@/lib/redis";
import type { AppEnv } from "@/types/context";

// ── Limits (conservative defaults — tune for production load) ─────────────────
const BURST_LIMIT = 20;       // max requests per second per IP
const SUSTAINED_LIMIT = 200;  // max requests per minute per IP
const PRODUCT_LIST_LIMIT = 100; // max requests per minute for GET /products

// ── In-memory fallback store ──────────────────────────────────────────────────
// C-11: Primary store is Redis (shared across all gateway instances and survives
// restarts). This fallback keeps the gateway functional during Redis outages at
// the cost of reverting to per-instance limiting only.
//
// C-12: Effect removed — incrementWindow is plain async, no Effect.sync / Effect.gen.
// Effect is only appropriate for typed async I/O errors (jwt.ts, hmac.ts);
// sync rate-limit arithmetic and a Redis call do not benefit from it.
type WindowEntry = { count: number; resetAt: number };
const fallbackStore = new Map<string, WindowEntry>();

// Periodically evict expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackStore) {
    if (now > entry.resetAt) fallbackStore.delete(key);
  }
}, 60_000);

function incrementWindowInMemory(
  ip: string,
  window: string,
  windowMs: number,
  limit: number
): { allowed: boolean; resetIn: number } {
  const key = `${ip}:${window}`;
  const now = Date.now();
  const entry = fallbackStore.get(key);

  if (!entry || now > entry.resetAt) {
    fallbackStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetIn: windowMs };
  }

  entry.count++;
  return { allowed: entry.count <= limit, resetIn: entry.resetAt - now };
}

// ── Redis-backed fixed window counter ─────────────────────────────────────────
// INCR is atomic — no race between read and write. EXPIRE is fired after the
// first INCR; the tiny gap is acceptable because a missed EXPIRE self-heals:
// the key eventually falls off the next window bucket. For strict guarantees a
// Lua eval could make both atomic, but that complexity is not warranted here.
//
// Key format: ratelimit:{ip}:{window}  (e.g. ratelimit:1.2.3.4:1s)
// Fail-open: Redis errors degrade to in-memory fallback, never to gateway failure.
async function incrementWindow(
  ip: string,
  window: string,
  windowMs: number,
  limit: number
): Promise<{ allowed: boolean; resetIn: number }> {
  const key = `ratelimit:${ip}:${window}`;
  const windowSec = Math.ceil(windowMs / 1000);

  try {
    const redis = getRedis();
    const count = await redis.incr(key);

    if (count === 1) {
      // First request in this window — attach TTL (fire-and-forget, non-critical)
      redis.expire(key, windowSec).catch(() => {
        /* non-critical: key will be evicted on next window cycle */
      });
    }

    const pttl = await redis.pttl(key);
    const resetIn = pttl > 0 ? pttl : windowMs;

    return { allowed: count <= limit, resetIn };
  } catch {
    // Redis unavailable — degrade gracefully to in-memory limiting
    return incrementWindowInMemory(ip, window, windowMs, limit);
  }
}

// ── Public product listing rate limiter ───────────────────────────────────────
// FIX PRD-06: Dedicated per-IP cap for GET /products to prevent catalogue
// scraping without penalising normal browsing. Stricter than the global limit
// (100 req/min vs 200 req/min). Applied after the global rateLimiter.
export const publicProductsRateLimiter: MiddlewareHandler<AppEnv> = async (
  c,
  next
) => {
  const ip = getClientIp(c);
  const { allowed, resetIn } = await incrementWindow(
    ip,
    "products:1m",
    60_000,
    PRODUCT_LIST_LIMIT
  );

  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(resetIn / 1000)));
    return c.json(
      {
        error: "Too Many Requests",
        code: "RATE_LIMITED",
        requestId: c.var.requestId,
      },
      429
    );
  }

  return next();
};

// ── Global rate limiter ───────────────────────────────────────────────────────
// Two windows checked per request in parallel: per-second burst and per-minute
// sustained. Both must pass — exceeding either triggers a 429.
export const rateLimiter: MiddlewareHandler<AppEnv> = async (c, next) => {
  const ip = getClientIp(c);

  const [perSecond, perMinute] = await Promise.all([
    incrementWindow(ip, "1s", 1_000, BURST_LIMIT),
    incrementWindow(ip, "1m", 60_000, SUSTAINED_LIMIT),
  ]);

  if (!perSecond.allowed || !perMinute.allowed) {
    // Report the longer of the two reset windows so the client knows when to retry
    const resetIn = !perSecond.allowed ? perSecond.resetIn : perMinute.resetIn;
    c.header("Retry-After", String(Math.ceil(resetIn / 1000)));
    return c.json(
      {
        error: "Too Many Requests",
        code: "RATE_LIMITED",
        requestId: c.var.requestId,
      },
      429
    );
  }

  return next();
};

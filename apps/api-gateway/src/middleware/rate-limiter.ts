import { Effect }              from "effect"
import type { MiddlewareHandler } from "hono"
import type { AppEnv }          from "@/types/context"

// ── In-memory sliding window rate limiter ─────────────────────────────────────
// Single-instance implementation. For multi-instance deployments, swap the
// store with an Upstash Redis client (same interface, same logic).
//
// Limits (conservative defaults — tune for production load):
const BURST_LIMIT     = 20   // max requests per second
const SUSTAINED_LIMIT = 200  // max requests per minute

type WindowEntry = { count: number; resetAt: number }
const store = new Map<string, WindowEntry>()

// Periodically evict expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60_000)

// ── Core window logic ─────────────────────────────────────────────────────────
function incrementWindow(
  ip:       string,
  window:   string,
  windowMs: number,
  limit:    number
): Effect.Effect<{ allowed: boolean; resetIn: number }, never> {
  return Effect.sync(() => {
    const key = `${ip}:${window}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return { allowed: true, resetIn: windowMs }
    }

    entry.count++
    return { allowed: entry.count <= limit, resetIn: entry.resetAt - now }
  })
}

// ── Middleware ────────────────────────────────────────────────────────────────
export const rateLimiter: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Prefer Cloudflare real IP, fall back to forwarded IP or socket IP
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"

  const check = Effect.gen(function* () {
    const perSecond = yield* incrementWindow(ip, "1s", 1_000,  BURST_LIMIT)
    const perMinute = yield* incrementWindow(ip, "1m", 60_000, SUSTAINED_LIMIT)

    if (!perSecond.allowed || !perMinute.allowed) {
      return yield* Effect.fail({ retryAfter: perMinute.resetIn })
    }
  })

  const result = await Effect.runPromiseExit(check)

  if (result._tag === "Failure") {
    const { retryAfter } = result.cause.error as { retryAfter: number }
    c.header("Retry-After", String(Math.ceil(retryAfter / 1000)))
    return c.json(
      { error: "Too Many Requests", code: "RATE_LIMITED", requestId: c.var.requestId },
      429
    )
  }

  await next()
}

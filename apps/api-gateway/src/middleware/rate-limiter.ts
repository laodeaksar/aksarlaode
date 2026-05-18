import { Effect } from "effect"
import type { MiddlewareHandler } from "hono"

import type { AppEnv } from "@/types/context"
import { getClientIp } from "@/lib/client-ip"

// ── In-memory sliding window rate limiter ─────────────────────────────────────
// Single-instance implementation. For multi-instance deployments, swap the
// store with an Upstash Redis client (same interface, same logic).
//
// Limits (conservative defaults — tune for production load):
const BURST_LIMIT = 20 // max requests per second
const SUSTAINED_LIMIT = 200 // max requests per minute

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
  ip: string,
  window: string,
  windowMs: number,
  limit: number
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

// FIX PRD-06: Dedicated per-IP rate limiter for the public product listing
// endpoint.  Stricter than the global limit (100 req/min vs 200 req/min) to
// prevent catalogue scraping without penalising normal browsing.
const PRODUCT_LIST_LIMIT = 100 // max requests per minute per IP for GET /products

export const publicProductsRateLimiter: MiddlewareHandler<AppEnv> = async (
  c,
  next
) => {
  const ip = getClientIp(c) // C-05

  const result = await Effect.runPromiseExit(
    incrementWindow(ip, "products:1m", 60_000, PRODUCT_LIST_LIMIT)
  )

  if (result._tag === "Success" && !result.value.allowed) {
    c.header("Retry-After", String(Math.ceil(result.value.resetIn / 1000)))
    return c.json(
      {
        error: "Too Many Requests",
        code: "RATE_LIMITED",
        requestId: c.var.requestId,
      },
      429
    )
  }

  await next()
}

// ── Global rate limiter middleware ────────────────────────────────────────────
export const rateLimiter: MiddlewareHandler<AppEnv> = async (c, next) => {
  const ip = getClientIp(c) // C-05

  const check = Effect.gen(function* () {
    const perSecond = yield* incrementWindow(ip, "1s", 1_000, BURST_LIMIT)
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
      {
        error: "Too Many Requests",
        code: "RATE_LIMITED",
        requestId: c.var.requestId,
      },
      429
    )
  }

  await next()
}

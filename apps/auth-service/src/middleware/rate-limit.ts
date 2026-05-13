import type { MiddlewareHandler } from "hono"

interface Entry {
  count:   number
  resetAt: number
}

function createRateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
  const store = new Map<string, Entry>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000).unref()

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown"

    const now   = Date.now()
    const entry = store.get(ip)

    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (entry.count >= maxRequests) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)))
      return c.json({ error: "Too many requests, please try again later" }, 429)
    }

    entry.count++
    return next()
  }
}

export const loginRateLimiter          = createRateLimiter(10, 15 * 60 * 1000)
export const registerRateLimiter       = createRateLimiter(5,  60 * 60 * 1000)
export const forgotPasswordRateLimiter = createRateLimiter(5,  60 * 60 * 1000)

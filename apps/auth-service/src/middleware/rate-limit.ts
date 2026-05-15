import { redis } from "@/lib/redis"

/**
 * Redis-backed fixed-window rate limiter.
 *
 * Uses INCR + EXPIRE so the counter is atomic and shared across all
 * auth-service replicas — bypassing via round-robin is not possible.
 *
 * Fail-closed: if Redis is unavailable the request is BLOCKED with 503.
 * Auth endpoints are high-value attack targets; silently disabling rate
 * limiting during an outage would leave login, register, and
 * password-reset routes wide open to brute force.
 * A structured error is emitted so the on-call team is alerted.
 *
 * IP resolution order:
 *   1. x-real-ip    — set directly by the API gateway to the client IP
 *   2. x-forwarded-for[0] — leftmost entry, trusted only when the gateway
 *      strips & rewrites the header before forwarding (verify gateway config)
 *   3. "unknown"    — fallback, all unknown clients share one bucket
 */
function createRateLimiter(maxRequests: number, windowSec: number, label: string) {
  return async ({
    request,
    set,
  }: {
    request: Request
    set:     { status?: number; headers: Record<string, string> }
  }) => {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"

    const key = `rate:${label}:${ip}`

    try {
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, windowSec)
      }

      if (current > maxRequests) {
        const ttl = await redis.ttl(key)
        set.status                 = 429
        set.headers["Retry-After"] = String(Math.max(ttl, 1))
        return { error: "Too many requests, please try again later", code: "RATE_LIMITED" }
      }
    } catch (err) {
      console.error(JSON.stringify({
        event:  "rate_limit_redis_error",
        label,
        ip,
        error:  String(err),
      }))
      // Fail-closed: block the request so a Redis outage cannot be exploited
      // to bypass brute-force protection on authentication endpoints.
      set.status                 = 503
      set.headers["Retry-After"] = String(windowSec)
      return {
        error: "Rate limiting service unavailable, please try again later",
        code:  "SERVICE_UNAVAILABLE",
      }
    }
  }
}

export const loginRateLimiter          = createRateLimiter(10, 15 * 60, "login")
export const registerRateLimiter       = createRateLimiter(5,  60 * 60, "register")
export const forgotPasswordRateLimiter = createRateLimiter(5,  60 * 60, "forgot-password")
export const changePasswordRateLimiter = createRateLimiter(5,  15 * 60, "change-password")
export const resetPasswordRateLimiter  = createRateLimiter(10, 60 * 60, "reset-password")
export const refreshRateLimiter        = createRateLimiter(30, 15 * 60, "refresh")

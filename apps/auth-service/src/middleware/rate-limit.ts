import { redis } from "@/lib/redis"

/**
 * Redis-backed sliding-window rate limiter.
 *
 * ── Why sliding window over fixed window ────────────────────────────────────
 * A fixed-window counter resets at a fixed interval (e.g. every 15 minutes).
 * This lets a client fire the full limit at 14:59:59 and immediately fire the
 * full limit again at 15:00:00 — effectively 2× the limit in ~2 seconds, which
 * is enough to run a credential-stuffing pass or a brute-force attack.
 *
 * A sliding window re-evaluates the limit over the most recent N seconds at
 * every request. There is no "reset moment" to exploit. The rate of allowed
 * requests is always ≤ maxRequests / windowSec regardless of timing.
 *
 * ── Implementation ───────────────────────────────────────────────────────────
 * Uses a Redis sorted set (ZSET) per (label, IP):
 *   - Score  = request timestamp in epoch milliseconds
 *   - Member = unique per-request token (prevents collisions between concurrent
 *              requests arriving at the exact same millisecond)
 *
 * On every request a Lua script runs atomically:
 *   1. ZREMRANGEBYSCORE — evict entries older than (now - windowMs)
 *   2. ZCARD           — count requests still within the window
 *   3. ZADD + EXPIRE   — record this request and refresh the TTL (if allowed)
 *
 * Running inside a Lua script means no race condition between step 2 and 3.
 * Without atomicity, two concurrent requests could both read "9 / 10" and
 * both get allowed, then both write, producing 11 entries in the window.
 *
 * ── Fail-closed ──────────────────────────────────────────────────────────────
 * If Redis is unavailable the request is BLOCKED (503). Auth endpoints are
 * high-value attack targets; silently disabling the limiter during a Redis
 * outage would leave login, register, and password-reset routes exposed.
 * A structured log is emitted so on-call is alerted.
 *
 * ── IP resolution ────────────────────────────────────────────────────────────
 * x-real-ip is set by the api-gateway's buildUpstreamHeaders() to the
 * verified client IP (from cf-connecting-ip or the reverse proxy's
 * x-real-ip). Client-supplied X-Forwarded-For is stripped by the gateway
 * before forwarding, so IP spoofing is not possible here.
 */

// ── Lua script — atomic sliding window ───────────────────────────────────────
//
// KEYS[1]  = sorted-set key  e.g. "rate:login:1.2.3.4"
// ARGV[1]  = now             epoch ms  (string)
// ARGV[2]  = window_start    epoch ms  (string) = now - windowMs
// ARGV[3]  = max_requests    integer   (string)
// ARGV[4]  = ttl_sec         integer   (string) = windowSec (for EXPIRE)
// ARGV[5]  = member          unique per-request token
//
// Returns:
//   {1, 0}            → allowed  (second element unused)
//   {0, retry_ms}     → blocked  (retry_ms = ms until a slot frees)
const SLIDING_WINDOW_SCRIPT = `
local key          = KEYS[1]
local now          = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local max_requests = tonumber(ARGV[3])
local ttl_sec      = tonumber(ARGV[4])
local member       = ARGV[5]

-- 1. Evict entries that have slid out of the rolling window
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- 2. Count how many requests remain in the window
local count = tonumber(redis.call('ZCARD', key))

if count < max_requests then
  -- 3a. Under limit — record this request and refresh the key TTL
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl_sec)
  return {1, 0}
else
  -- 3b. Over limit — compute when the oldest slot will leave the window.
  --     The oldest entry's score is its request timestamp (ms). It exits
  --     the window at (oldest_ts + windowMs), so the client must wait:
  --       retry_ms = oldest_ts + windowMs - now
  local oldest   = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_ms = 1000
  if oldest[2] then
    retry_ms = math.ceil(tonumber(oldest[2]) + (ttl_sec * 1000) - now)
    retry_ms = math.max(retry_ms, 1000)
  end
  redis.call('EXPIRE', key, ttl_sec)
  return {0, retry_ms}
end
` as const

// ── Factory ───────────────────────────────────────────────────────────────────
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

    const now         = Date.now()
    const windowMs    = windowSec * 1000
    const windowStart = now - windowMs

    // Unique member prevents two concurrent requests at the same millisecond
    // from sharing a ZADD entry and under-counting the window.
    const member = `${now}:${Math.random().toString(36).slice(2, 9)}`
    const key    = `rate:sw:${label}:${ip}`   // "sw" prefix distinguishes from old fixed-window keys

    try {
      const result = await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,                       // number of KEYS
        key,                     // KEYS[1]
        String(now),             // ARGV[1]
        String(windowStart),     // ARGV[2]
        String(maxRequests),     // ARGV[3]
        String(windowSec),       // ARGV[4]
        member,                  // ARGV[5]
      ) as [number, number]

      const [allowed, retryMs] = result

      if (!allowed) {
        const retryAfterSec = Math.ceil(retryMs / 1000)
        set.status                 = 429
        set.headers["Retry-After"] = String(retryAfterSec)
        set.headers["X-RateLimit-Limit"]     = String(maxRequests)
        set.headers["X-RateLimit-Window-Sec"] = String(windowSec)
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
      // to bypass brute-force protection on auth endpoints.
      set.status                 = 503
      set.headers["Retry-After"] = String(windowSec)
      return {
        error: "Rate limiting service unavailable, please try again later",
        code:  "SERVICE_UNAVAILABLE",
      }
    }
  }
}

// ── Per-endpoint limiters ─────────────────────────────────────────────────────
// Thresholds are per-IP over the given window.
// Login/change-password are tighter because a single valid credential can
// cause real harm; refresh is more generous because it's lower-risk and
// legitimate clients use it frequently.
export const loginRateLimiter          = createRateLimiter(10, 15 * 60, "login")
export const registerRateLimiter       = createRateLimiter(5,  60 * 60, "register")
export const forgotPasswordRateLimiter = createRateLimiter(5,  60 * 60, "forgot-password")
export const changePasswordRateLimiter = createRateLimiter(5,  15 * 60, "change-password")
export const resetPasswordRateLimiter  = createRateLimiter(10, 60 * 60, "reset-password")
export const refreshRateLimiter        = createRateLimiter(30, 15 * 60, "refresh")

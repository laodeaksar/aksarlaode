import { redis } from "@/lib/redis"
import { env }   from "@repo/env/order"

/**
 * Sliding-window rate limiter backed by a Redis sorted set.
 *
 * Algorithm (all three ops are atomic via a single Lua script):
 *  1. Remove all entries older than `now - windowMs` (expired slice of the window)
 *  2. Count remaining entries in the set
 *  3. If count >= limit → reject (return allowed = false)
 *  4. Otherwise → add a new unique entry scored by current timestamp, set key TTL
 *
 * The score is the request timestamp in ms.  Each member is `<ts>:<random>`
 * so two requests at the exact same millisecond don't overwrite each other.
 *
 * Returns:
 *   allowed   — whether the request is permitted
 *   limit     — configured max per window
 *   remaining — how many more requests are allowed in this window after this one
 *   resetMs   — epoch-ms when the oldest entry in the window will expire
 *               (i.e. when at least one slot frees up)
 */

export type RateLimitResult = {
  allowed:   boolean
  limit:     number
  remaining: number
  resetMs:   number
}

// ── Lua script — evaluated atomically on the Redis server ─────────────────────
const SLIDING_WINDOW_SCRIPT = `
local key     = KEYS[1]
local now     = tonumber(ARGV[1])
local window  = tonumber(ARGV[2])
local limit   = tonumber(ARGV[3])
local cutoff  = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset  = oldest[2] and math.floor(tonumber(oldest[2]) + window) or math.floor(now + window)
  return {0, count, reset}
end

local member = tostring(now) .. ':' .. tostring(math.random(1, 2000000))
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)

count = count + 1
local oldest2 = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset2  = oldest2[2] and math.floor(tonumber(oldest2[2]) + window) or math.floor(now + window)
return {1, count, reset2}
`

const KEY_PREFIX = "ratelimit:order:create:"

export async function checkOrderCreateRateLimit(userId: string): Promise<RateLimitResult> {
  const now      = Date.now()
  const windowMs = env.RATE_LIMIT_ORDER_CREATE_WINDOW_MS
  const limit    = env.RATE_LIMIT_ORDER_CREATE_MAX
  const key      = KEY_PREFIX + userId

  const raw = await redis.eval(
    SLIDING_WINDOW_SCRIPT,
    1,          // number of KEYS
    key,        // KEYS[1]
    String(now),
    String(windowMs),
    String(limit),
  ) as [number, number, number]

  const [allowedInt, count, resetMs] = raw

  return {
    allowed:   allowedInt === 1,
    limit,
    remaining: Math.max(0, limit - count),
    resetMs,
  }
}

import { env } from "@repo/env/order"

import { redis } from "@/lib/redis"

/**
 * Sliding-window rate limiter backed by a Redis sorted set.
 *
 * Algorithm (all three ops are atomic via a single Lua script):
 *  1. Remove all entries older than `now - windowMs`  (expired slice of the window)
 *  2. Count remaining entries in the set
 *  3. count >= limit  → reject, return allowed = false
 *  4. count <  limit  → add a new unique entry scored by current timestamp, set TTL
 *
 * Score  = request timestamp in ms.
 * Member = `<ts>:<random>` so two requests in the same millisecond don't collide.
 *
 * Returns:
 *   allowed   — whether the request is permitted
 *   limit     — configured max per window
 *   remaining — how many more requests are allowed after this one
 *   resetMs   — epoch-ms when the oldest current entry expires (first slot freed)
 */

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetMs: number
}

// ── Lua script — all ops run atomically on the Redis server ───────────────────
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

// ── Generic core — usable for any endpoint ────────────────────────────────────
export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now()

  const raw = (await redis.eval(
    SLIDING_WINDOW_SCRIPT,
    1,
    key,
    String(now),
    String(windowMs),
    String(limit)
  )) as [number, number, number]

  const [allowedInt, count, resetMs] = raw

  return {
    allowed: allowedInt === 1,
    limit,
    remaining: Math.max(0, limit - count),
    resetMs,
  }
}

// ── Per-endpoint helpers ──────────────────────────────────────────────────────

/** POST /orders — 5 requests per 60 s per userId (default, env-configurable) */
export function checkOrderCreateRateLimit(
  userId: string
): Promise<RateLimitResult> {
  return slidingWindowRateLimit(
    `ratelimit:order:create:${userId}`,
    env.RATE_LIMIT_ORDER_CREATE_MAX,
    env.RATE_LIMIT_ORDER_CREATE_WINDOW_MS
  )
}

/**
 * POST /webhooks/payment — 60 requests per 60 s per source IP (default).
 *
 * Designed to absorb all legitimate Midtrans retry traffic (max ~8 retries
 * per transaction, spread over 48 h) while blocking flood attacks.
 * The caller decides what HTTP status to return on rejection — the webhook
 * handler returns 200 on rate-limit so Midtrans does not keep re-queuing.
 */
export function checkWebhookRateLimit(
  sourceIp: string
): Promise<RateLimitResult> {
  return slidingWindowRateLimit(
    `ratelimit:webhook:payment:${sourceIp}`,
    env.RATE_LIMIT_WEBHOOK_MAX,
    env.RATE_LIMIT_WEBHOOK_WINDOW_MS
  )
}

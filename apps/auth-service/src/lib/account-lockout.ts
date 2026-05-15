/**
 * Per-email account lockout via Redis sliding window.
 *
 * ── Why per-email in addition to per-IP ──────────────────────────────────────
 * Per-IP rate limiting stops single-source brute force but is ineffective
 * against distributed credential-stuffing attacks: an attacker with 1,000
 * residential proxies can try 10,000 passwords against a single email in
 * 15 minutes (10 per IP × 1,000 IPs) while never tripping the per-IP limiter.
 *
 * A per-email sliding window adds an orthogonal defence: regardless of how
 * many IPs are used, a given email can only receive N login attempts per hour
 * before the account is temporarily locked. Legitimate users rarely need more
 * than 2–5 logins per hour.
 *
 * ── Key design decisions ──────────────────────────────────────────────────────
 * 1. The email is HASHED (SHA-256 hex) before use as a Redis key so that the
 *    key space does not leak plaintext email addresses into Redis.
 *
 * 2. Both successful AND failed attempts are counted. This prevents an attacker
 *    from working around the lockout by only submitting known-good passwords
 *    in the first N-1 slots. It also means a legitimate user who uses many
 *    devices simultaneously might occasionally see a lockout — the 20/hour
 *    threshold is chosen to make this extremely rare in practice.
 *
 * 3. Fail-open (opposite of the IP rate limiter): if Redis is unavailable, the
 *    lockout check is SKIPPED and the request proceeds. The per-IP rate limiter
 *    (which is fail-CLOSED) is still active, providing a fallback. An open-fail
 *    policy here avoids a Redis outage permanently locking all users out.
 *
 * 4. Uses the same atomic Lua sliding-window script as rate-limit.ts so the
 *    check-and-record is a single round-trip with no race conditions.
 *
 * ── Limits ───────────────────────────────────────────────────────────────────
 *   EMAIL_ATTEMPT_MAX    = 20 per hour
 *   EMAIL_ATTEMPT_WINDOW = 1 hour (3600 s)
 *
 * An attacker needs more than 20 IPs to try 20 passwords in one hour against
 * one email. Combined with Argon2id's ~300 ms hashing cost, the effective
 * throughput against a single account is ≤ 20 guesses / hour — negligible.
 */
import { redis } from "@/lib/redis"

const EMAIL_ATTEMPT_MAX        = 20
const EMAIL_ATTEMPT_WINDOW_SEC = 60 * 60   // 1 hour

// Reuses the same atomic Lua script pattern as rate-limit.ts.
// Returns [1, 0] if the attempt is allowed, [0, retry_ms] if locked.
const SLIDING_WINDOW_SCRIPT = `
local key          = KEYS[1]
local now          = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local max_requests = tonumber(ARGV[3])
local ttl_sec      = tonumber(ARGV[4])
local member       = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = tonumber(redis.call('ZCARD', key))

if count < max_requests then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl_sec)
  return {1, 0}
else
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

export type LockoutResult =
  | { locked: false }
  | { locked: true; retryAfterSec: number }

/**
 * Records a login attempt for the given email hash and checks whether the
 * email is now locked out.
 *
 * @param emailHash - SHA-256 hex digest of the raw email address (lowercase).
 *                    Use hashToken() from lib/token-hash.ts.
 *
 * Returns { locked: false } if the attempt is allowed.
 * Returns { locked: true, retryAfterSec } if the email has exceeded the limit.
 *
 * On Redis error: returns { locked: false } (fail-open — see module comment).
 */
export async function recordEmailAttempt(emailHash: string): Promise<LockoutResult> {
  const now         = Date.now()
  const windowMs    = EMAIL_ATTEMPT_WINDOW_SEC * 1000
  const windowStart = now - windowMs
  const member      = `${now}:${crypto.randomUUID()}`
  const key         = `lockout:email:${emailHash}`

  try {
    const result = await redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      String(now),
      String(windowStart),
      String(EMAIL_ATTEMPT_MAX),
      String(EMAIL_ATTEMPT_WINDOW_SEC),
      member,
    ) as [number, number]

    const [allowed, retryMs] = result

    if (!allowed) {
      return { locked: true, retryAfterSec: Math.ceil(retryMs / 1000) }
    }

    return { locked: false }
  } catch (err) {
    // Fail-open: log the error but let the request through.
    // The per-IP rate limiter (fail-closed) is still active.
    console.error(JSON.stringify({
      event:     "account_lockout_redis_error",
      emailHash: emailHash.slice(0, 8),   // first 8 chars for triage, not full hash
      error:     String(err),
    }))
    return { locked: false }
  }
}

/**
 * Per-email rate limiters via Redis sliding window.
 *
 * ── Login lockout (recordEmailAttempt) ───────────────────────────────────────
 * Limits to 20 login attempts / hour per email hash.
 * Fail-OPEN: Redis unavailable → request proceeds (per-IP limiter still active).
 *
 * ── Forgot-password limiter (recordForgotPasswordAttempt) ───────────────────
 * Limits to 3 reset requests / 15 minutes per email hash.
 * Tighter limit because each bypass allows one queued email (inbox flood /
 * email bombing). Unlike login, this is purely a rate gate — the response to
 * the caller is always the same 200 regardless of the check result (callers
 * must never branch on the return value in a way that reveals enumeration info).
 * Fail-OPEN: same rationale as login — a Redis outage must not lock all users
 * out of password reset permanently.
 */
import { redis } from "@/lib/redis";

// ── Shared atomic Lua sliding-window script ───────────────────────────────────
// Identical to rate-limit.ts; duplicated to avoid a shared-lib dependency.
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
` as const;

// ── Core sliding-window check ─────────────────────────────────────────────────
async function checkSlidingWindow(
  key: string,
  maxReq: number,
  windowSec: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const member = `${now}:${crypto.randomUUID()}`;

  try {
    const result = (await redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      String(now),
      String(windowStart),
      String(maxReq),
      String(windowSec),
      member
    )) as [number, number];

    const [allowed, retryMs] = result;
    return { allowed: allowed === 1, retryAfterSec: Math.ceil(retryMs / 1000) };
  } catch {
    return { allowed: true, retryAfterSec: 0 }; // fail-open
  }
}

// ── Login lockout ─────────────────────────────────────────────────────────────
const EMAIL_ATTEMPT_MAX = 20;
const EMAIL_ATTEMPT_WINDOW_SEC = 60 * 60; // 1 hour

export type LockoutResult =
  | { locked: false }
  | { locked: true; retryAfterSec: number };

/**
 * Records a login attempt for the given email hash and checks whether the
 * email is now locked out.
 *
 * @param emailHash - SHA-256 hex digest of the raw email address (lowercase).
 *                    Use hashToken() from lib/token-hash.ts.
 */
export async function recordEmailAttempt(
  emailHash: string
): Promise<LockoutResult> {
  const { allowed, retryAfterSec } = await checkSlidingWindow(
    `lockout:email:${emailHash}`,
    EMAIL_ATTEMPT_MAX,
    EMAIL_ATTEMPT_WINDOW_SEC
  );
  if (!allowed) return { locked: true, retryAfterSec };
  return { locked: false };
}

// ── Forgot-password per-email rate gate ───────────────────────────────────────
// FIX AUTH-01: tighter limit to prevent email-bombing.
// 3 requests per 15 minutes per hashed email address.
// Fail-OPEN: if Redis is unavailable, let the request through (the per-IP
// forgotPasswordRateLimiter on the route still applies).
const FORGOT_MAX = 3;
const FORGOT_WINDOW_SEC = 15 * 60; // 15 minutes

export type ForgotPasswordRateResult =
  | { limited: false }
  | { limited: true; retryAfterSec: number };

/**
 * Records a forgot-password attempt for the given email hash and returns
 * whether the request should be silently rate-limited.
 *
 * IMPORTANT: callers MUST NOT branch on `limited: true` in a way that produces
 * a different HTTP response status — doing so would allow email enumeration
 * (attacker observes 429 only for registered emails if the limit is reached
 * faster when an email exists). Always return the same 200 body regardless.
 *
 * @param emailHash - SHA-256 hex digest of the lowercase email.
 */
export async function recordForgotPasswordAttempt(
  emailHash: string
): Promise<ForgotPasswordRateResult> {
  const { allowed, retryAfterSec } = await checkSlidingWindow(
    `ratelimit:forgot:${emailHash}`,
    FORGOT_MAX,
    FORGOT_WINDOW_SEC
  );
  if (!allowed) return { limited: true, retryAfterSec };
  return { limited: false };
}

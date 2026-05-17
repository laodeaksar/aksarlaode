import { redis } from "@/lib/redis"

/**
 * Redis-backed session denylist.
 *
 * When a user logs out or revokes a session, the sessionId is written here
 * so that any access token carrying that sessionId can be detected as
 * revoked before its natural expiry.
 *
 * TTL is intentionally set to the access token's own lifetime (5 minutes).
 * After that the access token has expired naturally and the denylist entry
 * is no longer needed — Redis evicts it automatically, keeping memory usage
 * proportional to the number of recent revocations rather than all-time.
 *
 * ── How to use this at the API gateway ──────────────────────────────────────
 * The gateway's authResolver verifies JWT signature and expiry locally.
 * To also enforce revocation, call this service's internal endpoint:
 *
 *   GET /auth/internal/session/:id/valid
 *   Header: x-service-token: <INTERNAL_SERVICE_TOKEN>
 *   → 200 (active) | 401 (revoked)
 *
 * The circuit breaker on the gateway side will handle auth-service downtime.
 * ────────────────────────────────────────────────────────────────────────────
 */

const ACCESS_TOKEN_TTL_SECONDS = 5 * 60 // Must match token.ts signToken() call

const denylistKey = (sessionId: string) => `denylist:session:${sessionId}`

/**
 * Mark a session as revoked for the duration of the access token lifetime.
 *
 * Fire-and-forget: a Redis error is logged but does NOT block the
 * logout/revoke HTTP response. The reduced 5-minute access token TTL
 * limits the exposure window if this write fails.
 */
export async function denySession(sessionId: string): Promise<void> {
  try {
    await redis.setex(denylistKey(sessionId), ACCESS_TOKEN_TTL_SECONDS, "1")
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "denylist_write_error",
        sessionId,
        error: String(err),
      })
    )
  }
}

/**
 * Returns true when the sessionId has been explicitly revoked.
 *
 * Fail-closed: if Redis is unavailable, returns true (deny) to prevent
 * revoked sessions from being accepted during Redis outages.
 */
export async function isSessionDenied(sessionId: string): Promise<boolean> {
  try {
    const val = await redis.get(denylistKey(sessionId))
    return val === "1"
  } catch {
    return true // fail-closed
  }
}

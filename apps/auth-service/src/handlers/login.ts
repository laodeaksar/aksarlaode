import { Effect }                                    from "effect"
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password"
import { issueTokenPair }                            from "@/lib/token"
import { hashToken }                                 from "@/lib/token-hash"
import { userRepository }                            from "@/repository/user.repository"
import { sessionRepository }                         from "@/repository/session.repository"
import { writeAuditLog }                             from "@/lib/audit-log"
import { recordEmailAttempt }                        from "@/lib/account-lockout"
import { maskEmail }                                 from "@/lib/pii"
import { AuthError, toErrorResponse }                from "@repo/common/errors"

/**
 * Maximum number of concurrent sessions allowed per user.
 *
 * When a user logs in and already has MAX_SESSIONS active sessions, the
 * oldest session (by createdAt) is evicted to make room for the new one.
 * This enforces a hard upper bound on session table growth and gives users
 * a natural signal (via the sessions list) that a device they have not used
 * recently has been signed out.
 *
 * Choosing 5: covers phone, tablet, laptop, work machine, and one spare —
 * enough for legitimate users, low enough to make mass session accumulation
 * (e.g. after credential stuffing) visible in the sessions list.
 */
const MAX_SESSIONS_PER_USER = 5

// FIX AUTH-06: Extract IP and User-Agent from request headers so they appear
// in every LOGIN_FAILED and LOGIN_SUCCESS audit entry.  IP is read from
// x-real-ip (injected by the gateway) with a fallback to x-forwarded-for.
function extractClientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  )
}

export const loginHandler = async ({
  body,
  set,
  request,
}: {
  body:    { email: string; password: string }
  set:     any
  request: Request
}) => {
  const ip        = extractClientIp(request)
  const userAgent = request.headers.get("user-agent") ?? "unknown"
  // ── Per-email account lockout ─────────────────────────────────────────────
  // Check and record this attempt BEFORE any DB query. Both successful and
  // failed attempts count so an attacker cannot work around the limit by
  // knowing the correct password. The email is hashed before use as a key
  // so plaintext addresses are never stored in Redis.
  //
  // This is orthogonal to the per-IP rate limiter: an attacker using 1,000
  // IPs is still bounded to 20 attempts per hour against this specific email.
  const emailHash    = await hashToken(body.email.toLowerCase().trim())
  const lockoutCheck = await recordEmailAttempt(emailHash)

  if (lockoutCheck.locked) {
    set.status = 429
    set.headers["Retry-After"] = String(lockoutCheck.retryAfterSec)
    return { error: "Too many login attempts. Please try again later.", code: "ACCOUNT_LOCKED" }
  }

  const program = Effect.gen(function* () {
    // ── 1. Verify credentials ───────────────────────────────────────────────
    const user = yield* userRepository.findByEmail(body.email)
    if (!user) return yield* Effect.fail(new AuthError("Invalid credentials"))

    const valid = yield* verifyPassword(body.password, user.passwordHash)
    if (!valid) return yield* Effect.fail(new AuthError("Invalid credentials"))

    // ── 2. Transparent Argon2id upgrade ─────────────────────────────────────
    // If the stored hash uses the legacy PBKDF2 format, re-hash with Argon2id
    // now that we have the plaintext password. orElse ensures a DB hiccup here
    // never blocks login.
    if (needsRehash(user.passwordHash)) {
      yield* hashPassword(body.password).pipe(
        Effect.flatMap(newHash => userRepository.updatePasswordHash(user.id, newHash)),
        Effect.orElse(() => Effect.void)
      )
    }

    // ── 3. Enforce per-user session cap ─────────────────────────────────────
    // Count active sessions. If at or above the limit, evict the oldest
    // session(s) to make room. orElse means a DB hiccup here never blocks
    // login — worst case the user briefly exceeds the cap by 1.
    const sessionCount = yield* sessionRepository.countByUserId(user.id).pipe(
      Effect.orElse(() => Effect.succeed(0))
    )

    if (sessionCount >= MAX_SESSIONS_PER_USER) {
      const excess = sessionCount - MAX_SESSIONS_PER_USER + 1   // +1 for the session we're about to create
      yield* sessionRepository.deleteOldestByUserId(user.id, excess).pipe(
        Effect.orElse(() => Effect.void)
      )

      console.info(JSON.stringify({
        event:    "session_cap_eviction",
        userId:   user.id,
        evicted:  excess,
        cap:      MAX_SESSIONS_PER_USER,
      }))
    }

    // ── 4. Issue tokens and create new session ───────────────────────────────
    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId, user.email)

    const refreshTokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(tokens.refreshToken),
      catch: () => new AuthError("Internal error"),
    })
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({
      id: sessionId, userId: user.id, token: refreshTokenHash, expiresAt,
    })

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    // FIX AUTH-06: Include ip and userAgent so log aggregators can correlate
    // failed attempts across IPs (credential stuffing detection).  Email is
    // masked to protect PII; actorId "anonymous" signals unverified identity.
    writeAuditLog({
      event:    "LOGIN_FAILED",
      actorId:  "anonymous",
      targetId: "anonymous",
      meta:     {
        emailMask: maskEmail(body.email),
        ip,
        userAgent,
      },
    })

    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  const { user, tokens } = result.value

  // FIX AUTH-06: ip and userAgent added to LOGIN_SUCCESS as well so the same
  // session can be traced across both success and failure events.  Email is
  // still omitted — actorId (userId) is sufficient for correlation.
  writeAuditLog({
    event:    "LOGIN_SUCCESS",
    actorId:  user.id,
    targetId: user.id,
    meta:     { role: user.role, ip, userAgent },
  })

  if (user.role === "OWNER") {
    writeAuditLog({
      event:    "OWNER_LOGIN",
      actorId:  user.id,
      targetId: user.id,
    })
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=${60 * 60 * 24 * 7}`

  return { user, accessToken: tokens.accessToken }
}

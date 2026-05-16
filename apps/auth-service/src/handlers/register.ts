import { Effect }                  from "effect"
import { hashPassword }            from "@/lib/password"
import { issueTokenPair }          from "@/lib/token"
import { hashToken }               from "@/lib/token-hash"
import { userRepository }          from "@/repository/user.repository"
import { createUserWithSession }   from "@/repository/auth.repository"
import { writeAuditLog }           from "@/lib/audit-log"
import { checkPasswordStrength }   from "@/lib/password-strength"
import { AuthError, ConflictError, ValidationError, toErrorResponse } from "@repo/common/errors"

export const registerHandler = async ({
  body,
  set,
}: {
  body: { email: string; name: string; password: string }
  set:  any
}) => {
  const program = Effect.gen(function* () {
    // ── 1. Fast-path duplicate check ─────────────────────────────────────────
    // Check before the expensive Argon2 hash. This catches most duplicates
    // cheaply. The narrow race window (between this check and the DB insert)
    // is handled by the 23505 catch in createUserWithSession.
    const existing = yield* userRepository.findByEmail(body.email)
    if (existing) return yield* Effect.fail(new ConflictError("email"))

    // ── 1b. Common-password denylist ─────────────────────────────────────────
    // Checked before Argon2 — no point hashing a trivially guessable password.
    const weakMsg = checkPasswordStrength(body.password)
    if (weakMsg) return yield* Effect.fail(new ValidationError(undefined, weakMsg))

    // ── 2. Hash password ─────────────────────────────────────────────────────
    const passwordHash = yield* hashPassword(body.password)

    // ── 3. Pre-generate IDs, then issue tokens ───────────────────────────────
    // IDs are pre-generated so the JWT (which embeds userId) can be signed
    // before the DB write. If the transaction rolls back, these tokens are
    // worthless — the gateway rejects any session lookup for a non-existent
    // userId+sessionId pair.
    const userId    = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(userId, "CUSTOMER", sessionId, body.email)

    const refreshTokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(tokens.refreshToken),
      catch: () => new AuthError("Internal error"),
    })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // ── 4. Atomic: INSERT user + INSERT session in one transaction ────────────
    // Eliminates the ghost-account failure mode where user row is created but
    // session INSERT fails. On Postgres 23505 (concurrent duplicate email),
    // createUserWithSession returns ConflictError → 409.
    const { user } = yield* createUserWithSession(
      { id: userId, email: body.email, name: body.name, passwordHash, role: "CUSTOMER" },
      { id: sessionId, userId, token: refreshTokenHash, expiresAt },
    )

    return { user: { id: user.id, email: user.email, name: user.name }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  const { user, tokens } = result.value

  // F-04: Audit account creation — important for detecting mass-registration
  // attacks and for forensic trail after a breach.
  writeAuditLog({
    event:    "ACCOUNT_CREATED",
    actorId:  user.id,
    targetId: user.id,
    meta:     { email: user.email },
  })

  set.status = 201

  // F-01: Path=/auth (not Path=/auth/refresh) so the cookie is sent to ALL
  // sub-paths including /auth/logout. A narrower path means logout silently
  // fails to clear the session from the database.
  set.headers["Set-Cookie"] =
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=${60 * 60 * 24 * 7}`

  return { user, accessToken: tokens.accessToken }
}

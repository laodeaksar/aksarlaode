import { Effect }               from "effect"
import { hashPassword }         from "@/lib/password"
import { hashToken }            from "@/lib/token-hash"
import { userRepository }       from "@/repository/user.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { consumeResetToken }    from "@/repository/auth.repository"
import { writeAuditLog }        from "@/lib/audit-log"
import { AuthError, GoneError, NotFoundError, ConflictError, toErrorResponse } from "@repo/common/errors"
import { message }              from "@repo/common/response"

export const resetPasswordHandler = async ({
  body,
  set,
}: {
  body: { token: string; newPassword: string }
  set:  any
}) => {
  const program = Effect.gen(function* () {
    const tokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(body.token),
      catch: () => new AuthError("Invalid reset token"),
    })

    // Validate the token exists and has not expired BEFORE hashing the new
    // password (Argon2id is expensive — no point running it on invalid tokens).
    const record = yield* resetTokenRepository.findByToken(tokenHash)
    if (!record) return yield* Effect.fail(new AuthError("Invalid reset token"))

    if (record.expiresAt < new Date()) {
      // Best-effort cleanup of the expired token. orElse: a DB hiccup here
      // must not mask the real error returned to the client.
      yield* resetTokenRepository.deleteByToken(tokenHash).pipe(Effect.orElse(() => Effect.void))
      return yield* Effect.fail(new GoneError("Reset token has expired"))
    }

    const user = yield* userRepository.findById(record.userId)
    if (!user) return yield* Effect.fail(new NotFoundError("User"))

    const newHash = yield* hashPassword(body.newPassword)

    // ── Atomic: consume token + update password + invalidate sessions ─────────
    // consumeResetToken runs all three writes in a single Postgres transaction.
    //
    // Without atomicity, a transient DB error between "update password" and
    // "delete token" leaves the token live — an attacker who intercepted the
    // reset URL can reuse it to reset the password to a value they control.
    //
    // ConflictError here means the token was already consumed (concurrent
    // request or replay attempt) → treat the same as "invalid token" (401).
    yield* consumeResetToken(tokenHash, user.id, newHash).pipe(
      Effect.mapError((e) =>
        e instanceof ConflictError ? new AuthError("Invalid reset token") : e
      )
    )

    return { userId: user.id }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  writeAuditLog({
    event:    "PASSWORD_RESET",
    actorId:  result.value.userId,
    targetId: result.value.userId,
  })

  set.headers["Set-Cookie"] =
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0`

  return message("Password reset successful. Please log in with your new password.")
}

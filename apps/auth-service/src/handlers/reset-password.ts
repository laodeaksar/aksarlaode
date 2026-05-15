import { Effect }               from "effect"
import { hashPassword }         from "@/lib/password"
import { hashToken }            from "@/lib/token-hash"
import { userRepository }       from "@/repository/user.repository"
import { sessionRepository }    from "@/repository/session.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { writeAuditLog }        from "@/lib/audit-log"
import { AuthError, GoneError, NotFoundError, toErrorResponse } from "@repo/common/errors"
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

    const record = yield* resetTokenRepository.findByToken(tokenHash)
    if (!record) return yield* Effect.fail(new AuthError("Invalid reset token"))

    if (record.expiresAt < new Date()) {
      yield* resetTokenRepository.deleteByToken(tokenHash).pipe(Effect.orElse(() => Effect.void))
      return yield* Effect.fail(new GoneError("Reset token has expired"))
    }

    const user = yield* userRepository.findById(record.userId)
    if (!user) return yield* Effect.fail(new NotFoundError("User"))

    const newHash = yield* hashPassword(body.newPassword)
    yield* userRepository.updatePasswordHash(user.id, newHash)
    yield* resetTokenRepository.deleteByToken(tokenHash)
    yield* sessionRepository.deleteAllByUserId(user.id)

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

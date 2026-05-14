import { Effect }               from "effect"
import { hashPassword }         from "@/lib/password"
import { userRepository }       from "@/repository/user.repository"
import { sessionRepository }    from "@/repository/session.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { ResetPasswordSchema }  from "@repo/common"
import { ValidationError, AuthError, GoneError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import { message }              from "@repo/common/response"
import type { HandlerCtx }      from "@/types"

export const resetPasswordHandler = async ({ body, set }: HandlerCtx) => {
  const program = Effect.gen(function* () {
    const input = yield* Effect.try({
      try:   () => ResetPasswordSchema.parse(body),
      catch: () => new ValidationError(),
    })

    const record = yield* resetTokenRepository.findByToken(input.token)
    if (!record) return yield* Effect.fail(new AuthError("Invalid reset token"))

    if (record.expiresAt < new Date()) {
      yield* resetTokenRepository.deleteByToken(input.token).pipe(Effect.orElse(() => Effect.void))
      return yield* Effect.fail(new GoneError("Reset token has expired"))
    }

    const user = yield* userRepository.findById(record.userId)
    if (!user) return yield* Effect.fail(new NotFoundError("User"))

    const newHash = yield* hashPassword(input.newPassword)
    yield* userRepository.updatePasswordHash(user.id, newHash)
    yield* resetTokenRepository.deleteByToken(input.token)
    yield* sessionRepository.deleteAllByUserId(user.id)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`

  return message("Password reset successful. Please log in with your new password.")
}

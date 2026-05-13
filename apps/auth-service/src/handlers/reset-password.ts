import { Effect }               from "effect"
import type { Context }         from "hono"
import { hashPassword }         from "@/lib/password"
import { userRepository }       from "@/repository/user.repository"
import { sessionRepository }    from "@/repository/session.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { ResetPasswordSchema }  from "@repo/common"
import { ValidationError, AuthError, GoneError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }          from "@/types"

export const resetPasswordHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input
    const input = yield* Effect.try({
      try:   () => ResetPasswordSchema.parse(body),
      catch: () => new ValidationError(),
    })

    // 2. Look up token in DB
    const record = yield* resetTokenRepository.findByToken(input.token)
    if (!record) return yield* Effect.fail(new AuthError("Invalid reset token"))

    // 3. Check expiry
    if (record.expiresAt < new Date()) {
      yield* resetTokenRepository.deleteByToken(input.token).pipe(Effect.orElse(() => Effect.void))
      return yield* Effect.fail(new GoneError("Reset token has expired"))
    }

    // 4. Verify user still exists
    const user = yield* userRepository.findById(record.userId)
    if (!user) return yield* Effect.fail(new NotFoundError("User"))

    // 5. Hash new password
    const newHash = yield* hashPassword(input.newPassword)

    // 6. Persist new password
    yield* userRepository.updatePasswordHash(user.id, newHash)

    // 7. Consume the token (one-time use)
    yield* resetTokenRepository.deleteByToken(input.token)

    // 8. Revoke ALL active sessions
    yield* sessionRepository.deleteAllByUserId(user.id)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  c.header("Set-Cookie",
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`
  )
  return c.json({ message: "Password reset successful. Please log in with your new password." })
}

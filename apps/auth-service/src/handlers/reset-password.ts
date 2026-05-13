import { Effect }               from "effect"
import type { Context }         from "hono"
import { hashPassword }         from "@/lib/password"
import { userRepository }       from "@/repository/user.repository"
import { sessionRepository }    from "@/repository/session.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { ResetPasswordSchema }  from "@repo/common"
import type { AppEnv }          from "@/types"

export const resetPasswordHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input
    const input = yield* Effect.try({
      try:   () => ResetPasswordSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    // 2. Look up token in DB
    const record = yield* resetTokenRepository.findByToken(input.token)
    if (!record) {
      return yield* Effect.fail({ _tag: "InvalidTokenError" as const })
    }

    // 3. Check expiry
    if (record.expiresAt < new Date()) {
      // Clean up the expired token
      yield* resetTokenRepository.deleteByToken(input.token).pipe(Effect.orElse(() => Effect.void))
      return yield* Effect.fail({ _tag: "ExpiredTokenError" as const })
    }

    // 4. Verify user still exists
    const user = yield* userRepository.findById(record.userId)
    if (!user) {
      return yield* Effect.fail({ _tag: "InvalidTokenError" as const })
    }

    // 5. Hash new password
    const newHash = yield* hashPassword(input.newPassword)

    // 6. Persist new password
    yield* userRepository.updatePasswordHash(user.id, newHash)

    // 7. Consume the token (one-time use)
    yield* resetTokenRepository.deleteByToken(input.token)

    // 8. Revoke ALL active sessions — force re-login on every device
    yield* sessionRepository.deleteAllByUserId(user.id)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "ValidationError")  return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "ExpiredTokenError") return c.json({ error: "Reset token has expired" }, 410)
    if (err._tag === "InvalidTokenError") return c.json({ error: "Invalid reset token" }, 400)
    return c.json({ error: "Password reset failed" }, 500)
  }

  // Clear refresh cookie if the user happens to be on a device with an active session
  c.header("Set-Cookie",
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`
  )
  return c.json({ message: "Password reset successful. Please log in with your new password." })
}

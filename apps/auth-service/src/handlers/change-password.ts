import { Effect }             from "effect"
import type { Context }       from "hono"
import { verifyPassword, hashPassword } from "@/lib/password"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { ChangePasswordSchema } from "@repo/common"
import { AuthError, NotFoundError, ValidationError, toErrorResponse } from "@repo/common/errors"
import { message }           from "@repo/common/response"
import type { AppEnv }       from "@/types"

export const changePasswordHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json(toErrorResponse(new AuthError()).body, 401 as any)

  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input (also enforces currentPassword !== newPassword)
    const input = yield* Effect.try({
      try:   () => ChangePasswordSchema.parse(body),
      catch: () => new ValidationError(),
    })

    // 2. Load user
    const user = yield* userRepository.findById(userId)
    if (!user) return yield* Effect.fail(new NotFoundError("User"))

    // 3. Verify current password
    const valid = yield* verifyPassword(input.currentPassword, user.passwordHash)
    if (!valid) return yield* Effect.fail(new AuthError("Current password is incorrect"))

    // 4. Hash & persist new password
    const newHash = yield* hashPassword(input.newPassword)
    yield* userRepository.updatePasswordHash(userId, newHash)

    // 5. Revoke ALL active sessions — force re-login on every device
    yield* sessionRepository.deleteAllByUserId(userId)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  c.header("Set-Cookie",
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`
  )
  return c.json(message("Password changed. Please log in again."))
}

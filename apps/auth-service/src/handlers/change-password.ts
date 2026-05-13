import { Effect }             from "effect"
import type { Context }       from "hono"
import { verifyPassword, hashPassword } from "@/lib/password"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { ChangePasswordSchema } from "@repo/common"
import type { AppEnv }       from "@/types"

export const changePasswordHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json({ error: "Unauthorized" }, 401)

  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input (also enforces currentPassword !== newPassword)
    const input = yield* Effect.try({
      try:   () => ChangePasswordSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    // 2. Load user — must exist
    const user = yield* userRepository.findById(userId)
    if (!user) {
      return yield* Effect.fail({ _tag: "NotFoundError" as const })
    }

    // 3. Verify current password before allowing the change
    const valid = yield* verifyPassword(input.currentPassword, user.passwordHash)
    if (!valid) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    // 4. Hash new password
    const newHash = yield* hashPassword(input.newPassword)

    // 5. Persist new password hash
    yield* userRepository.updatePasswordHash(userId, newHash)

    // 6. Revoke ALL active sessions — forces re-login on every device
    yield* sessionRepository.deleteAllByUserId(userId)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "ValidationError") return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "NotFoundError")   return c.json({ error: "User not found" }, 404)
    if (err._tag === "AuthError")       return c.json({ error: "Current password is incorrect" }, 401)
    return c.json({ error: "Password change failed" }, 500)
  }

  // Clear the refresh cookie on the current device too
  c.header("Set-Cookie",
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`
  )
  return c.json({ message: "Password changed. Please log in again." })
}

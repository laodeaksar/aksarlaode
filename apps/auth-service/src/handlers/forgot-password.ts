import { Effect }               from "effect"
import type { Context }         from "hono"
import { userRepository }       from "@/repository/user.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { ForgotPasswordSchema } from "@repo/common"
import { ValidationError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }          from "@/types"

function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("")
}

export const forgotPasswordHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate email format
    const input = yield* Effect.try({
      try:   () => ForgotPasswordSchema.parse(body),
      catch: () => new ValidationError(),
    })

    // 2. Look up user — proceed silently if not found (prevent enumeration)
    const user = yield* userRepository.findByEmail(input.email)
    if (!user) return null

    // 3. Invalidate existing reset tokens for this user
    yield* resetTokenRepository.deleteAllByUserId(user.id)

    // 4. Issue a new token valid for 1 hour
    const token     = generateResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    yield* resetTokenRepository.create({ token, userId: user.id, expiresAt })

    return token
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  // Always return 200 with same message regardless of whether email exists —
  // prevents user enumeration. The token is returned for the API gateway / email service.
  return c.json({
    message:    "If that email is registered, a reset token has been issued.",
    resetToken: result.value ?? null,
  })
}

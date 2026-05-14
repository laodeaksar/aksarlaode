import { Effect }               from "effect"
import { userRepository }       from "@/repository/user.repository"
import { resetTokenRepository } from "@/repository/reset-token.repository"
import { ForgotPasswordSchema } from "@repo/common"
import { ValidationError, toErrorResponse } from "@repo/common/errors"
import type { HandlerCtx }      from "@/types"

function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("")
}

export const forgotPasswordHandler = async ({ body, set }: HandlerCtx) => {
  const program = Effect.gen(function* () {
    const input = yield* Effect.try({
      try:   () => ForgotPasswordSchema.parse(body),
      catch: () => new ValidationError(),
    })

    const user = yield* userRepository.findByEmail(input.email)
    if (!user) return null

    yield* resetTokenRepository.deleteAllByUserId(user.id)

    const token     = generateResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    yield* resetTokenRepository.create({ token, userId: user.id, expiresAt })

    return token
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  return {
    message:    "If that email is registered, a reset token has been issued.",
    resetToken: result.value ?? null,
  }
}

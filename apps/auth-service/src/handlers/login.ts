import { Effect }            from "effect"
import { verifyPassword }    from "@/lib/password"
import { issueTokenPair }    from "@/lib/token"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { LoginSchema }       from "@repo/common"
import { AuthError, ValidationError, toErrorResponse } from "@repo/common/errors"
import type { HandlerCtx }   from "@/types"

export const loginHandler = async ({ body, set }: HandlerCtx) => {
  const program = Effect.gen(function* () {
    const input = yield* Effect.try({
      try:   () => LoginSchema.parse(body),
      catch: () => new ValidationError(),
    })

    const user = yield* userRepository.findByEmail(input.email)

    if (!user) return yield* Effect.fail(new AuthError("Invalid credentials"))

    const valid = yield* verifyPassword(input.password, user.passwordHash)
    if (!valid) return yield* Effect.fail(new AuthError("Invalid credentials"))

    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({ id: sessionId, userId: user.id, token: tokens.refreshToken, expiresAt })

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  const { user, tokens } = result.value

  set.headers["Set-Cookie"] =
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`

  return { user, accessToken: tokens.accessToken }
}

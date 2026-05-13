import { Effect }             from "effect"
import type { Context }       from "hono"
import { hashPassword }       from "@/lib/password"
import { issueTokenPair }     from "@/lib/token"
import { userRepository }     from "@/repository/user.repository"
import { sessionRepository }  from "@/repository/session.repository"
import { RegisterSchema }     from "@repo/common"
import { ValidationError, ConflictError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }        from "@/types"

export const registerHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input
    const input = yield* Effect.try({
      try:   () => RegisterSchema.parse(body),
      catch: () => new ValidationError(),
    })

    // 2. Check email uniqueness
    const existing = yield* userRepository.findByEmail(input.email)
    if (existing) return yield* Effect.fail(new ConflictError("email"))

    // 3. Hash password
    const passwordHash = yield* hashPassword(input.password)

    // 4. Persist user
    const user = yield* userRepository.create({
      email: input.email, name: input.name, passwordHash, role: "CUSTOMER",
    })

    // 5. Issue tokens
    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId)

    // 6. Persist session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({ id: sessionId, userId: user.id, token: tokens.refreshToken, expiresAt })

    return { user: { id: user.id, email: user.email, name: user.name }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  const { user, tokens } = result.value

  c.header("Set-Cookie",
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`
  )
  return c.json({ user, accessToken: tokens.accessToken }, 201)
}

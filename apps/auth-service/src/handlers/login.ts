import { Effect } from "effect"
import type { Context } from "hono"
import { verifyPassword }  from "../lib/password"
import { issueTokenPair }  from "../lib/token"
import { userRepository }  from "../repository/user.repository"
import { LoginSchema }     from "@repo/common"
import type { AppEnv }     from "../types"

export const loginHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    const input = yield* Effect.try({
      try:   () => LoginSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    const user = yield* userRepository.findByEmail(input.email)

    // Deliberate: same error for "not found" and "wrong password"
    // prevents user enumeration
    if (!user) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    const valid = yield* verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId)

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "ValidationError") return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "AuthError")       return c.json({ error: "Invalid credentials" }, 401)
    return c.json({ error: "Login failed" }, 500)
  }

  const { user, tokens } = result.value

  c.header("Set-Cookie",
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60*60*24*7}`
  )
  return c.json({ user, accessToken: tokens.accessToken })
}

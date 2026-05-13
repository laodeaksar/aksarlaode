import { Effect } from "effect"
import type { Context } from "hono"
import { hashPassword }    from "@/lib/password"
import { issueTokenPair }  from "@/lib/token"
import { userRepository }  from "@/repository/user.repository"
import { RegisterSchema }  from "@repo/common"
import type { AppEnv }     from "@/types"

export const registerHandler = async (c: Context<AppEnv>) => {
  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input
    const input = yield* Effect.try({
      try:   () => RegisterSchema.parse(body),
      catch: (e) => ({ _tag: "ValidationError" as const, issues: e }),
    })

    // 2. Check email uniqueness
    const existing = yield* userRepository.findByEmail(input.email)
    if (existing) {
      return yield* Effect.fail({ _tag: "ConflictError" as const, field: "email" })
    }

    // 3. Hash password
    const passwordHash = yield* hashPassword(input.password)

    // 4. Persist user
    const user = yield* userRepository.create({
      email:        input.email,
      name:         input.name,
      passwordHash,
      role:         "CUSTOMER",
    })

    // 5. Issue tokens
    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId)

    return { user: { id: user.id, email: user.email, name: user.name }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "ValidationError") return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "ConflictError")   return c.json({ error: "Email already exists" }, 409)
    return c.json({ error: "Registration failed" }, 500)
  }

  const { user, tokens } = result.value

  // httpOnly refresh token in cookie, access token in body
  c.header("Set-Cookie",
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60*60*24*7}`
  )
  return c.json({ user, accessToken: tokens.accessToken }, 201)
}

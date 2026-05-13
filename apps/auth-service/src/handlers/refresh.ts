import { Effect }             from "effect"
import type { Context }       from "hono"
import { verifyToken, issueTokenPair } from "@/lib/token"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { AuthError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }       from "@/types"

export const refreshHandler = async (c: Context<AppEnv>) => {
  const cookieHeader = c.req.header("cookie") ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const rawToken     = match?.[1] ? decodeURIComponent(match[1]) : null

  const program = Effect.gen(function* () {
    if (!rawToken) return yield* Effect.fail(new AuthError())

    // 1. Verify JWT signature & expiry
    const payload = yield* verifyToken(rawToken).pipe(
      Effect.mapError(() => new AuthError())
    )

    if (payload["type"] !== "refresh" || typeof payload["sub"] !== "string") {
      return yield* Effect.fail(new AuthError())
    }

    // 2. Verify session still exists in DB
    const session = yield* sessionRepository.findByToken(rawToken).pipe(
      Effect.mapError(() => new AuthError())
    )
    if (!session || session.expiresAt < new Date()) {
      return yield* Effect.fail(new AuthError())
    }

    // 3. Load user
    const user = yield* userRepository.findById(payload["sub"]).pipe(
      Effect.mapError(() => new AuthError())
    )
    if (!user) return yield* Effect.fail(new AuthError())

    // 4. Rotate: delete old session, issue fresh pair, persist new session
    yield* sessionRepository.deleteByToken(rawToken).pipe(
      Effect.mapError(() => new AuthError())
    )

    const newSessionId = crypto.randomUUID()
    const tokens       = yield* issueTokenPair(user.id, user.role, newSessionId).pipe(
      Effect.mapError(() => new AuthError())
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({
      id: newSessionId, userId: user.id, token: tokens.refreshToken, expiresAt,
    }).pipe(Effect.mapError(() => new AuthError()))

    return tokens
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  const tokens = result.value

  c.header("Set-Cookie",
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`
  )
  return c.json({ accessToken: tokens.accessToken })
}

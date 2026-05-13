import { Effect }             from "effect"
import type { Context }       from "hono"
import { verifyToken, issueTokenPair } from "@/lib/token"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import type { AppEnv }       from "@/types"

export const refreshHandler = async (c: Context<AppEnv>) => {
  const cookieHeader = c.req.header("cookie") ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const rawToken     = match?.[1] ? decodeURIComponent(match[1]) : null

  const program = Effect.gen(function* () {
    if (!rawToken) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    // 1. Verify JWT signature & expiry
    const payload = yield* verifyToken(rawToken).pipe(
      Effect.mapError(() => ({ _tag: "AuthError" as const }))
    )

    if (payload["type"] !== "refresh" || typeof payload["sub"] !== "string") {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    // 2. Verify session still exists in DB (not already logged out / revoked)
    const session = yield* sessionRepository.findByToken(rawToken).pipe(
      Effect.mapError(() => ({ _tag: "AuthError" as const }))
    )
    if (!session || session.expiresAt < new Date()) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    // 3. Load user
    const user = yield* userRepository.findById(payload["sub"]).pipe(
      Effect.mapError(() => ({ _tag: "AuthError" as const }))
    )
    if (!user) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    // 4. Rotate: delete old session, issue fresh token pair & persist new session
    yield* sessionRepository.deleteByToken(rawToken).pipe(
      Effect.mapError(() => ({ _tag: "AuthError" as const }))
    )

    const newSessionId = crypto.randomUUID()
    const tokens       = yield* issueTokenPair(user.id, user.role, newSessionId).pipe(
      Effect.mapError(() => ({ _tag: "AuthError" as const }))
    )

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({
      id:        newSessionId,
      userId:    user.id,
      token:     tokens.refreshToken,
      expiresAt,
    }).pipe(Effect.mapError(() => ({ _tag: "AuthError" as const })))

    return tokens
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    return c.json({ error: "Invalid or expired refresh token" }, 401)
  }

  const tokens = result.value

  c.header("Set-Cookie",
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`
  )
  return c.json({ accessToken: tokens.accessToken })
}

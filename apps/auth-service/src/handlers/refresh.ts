import { Effect }            from "effect"
import { verifyToken, issueTokenPair } from "@/lib/token"
import { hashToken }         from "@/lib/token-hash"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { AuthError, toErrorResponse } from "@repo/common/errors"
import type { HandlerCtx }   from "@/types"

export const refreshHandler = async ({ headers, set }: HandlerCtx) => {
  const cookieHeader = headers["cookie"] ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const rawToken     = match?.[1] ? decodeURIComponent(match[1]) : null

  const program = Effect.gen(function* () {
    if (!rawToken) return yield* Effect.fail(new AuthError())

    const rawTokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(rawToken),
      catch: () => new AuthError(),
    })

    const payload = yield* verifyToken(rawToken, "refresh").pipe(
      Effect.mapError(() => new AuthError())
    )

    if (typeof payload["sub"] !== "string") {
      return yield* Effect.fail(new AuthError())
    }

    const session = yield* sessionRepository.findByToken(rawTokenHash).pipe(
      Effect.mapError(() => new AuthError())
    )
    if (!session || session.expiresAt < new Date()) {
      return yield* Effect.fail(new AuthError())
    }

    const user = yield* userRepository.findById(payload["sub"]).pipe(
      Effect.mapError(() => new AuthError())
    )
    if (!user) return yield* Effect.fail(new AuthError())

    yield* sessionRepository.deleteByToken(rawTokenHash).pipe(
      Effect.mapError(() => new AuthError())
    )

    const newSessionId = crypto.randomUUID()
    const tokens       = yield* issueTokenPair(user.id, user.role, newSessionId).pipe(
      Effect.mapError(() => new AuthError())
    )

    const newRefreshTokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(tokens.refreshToken),
      catch: () => new AuthError(),
    })
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({
      id: newSessionId, userId: user.id, token: newRefreshTokenHash, expiresAt,
    }).pipe(Effect.mapError(() => new AuthError()))

    return tokens
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    set.status = status
    return body
  }

  const tokens = result.value

  set.headers["Set-Cookie"] =
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`

  return { accessToken: tokens.accessToken }
}

import { Effect }            from "effect"
import { verifyPassword }    from "@/lib/password"
import { issueTokenPair }    from "@/lib/token"
import { hashToken }         from "@/lib/token-hash"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { writeAuditLog }     from "@/lib/audit-log"
import { AuthError, toErrorResponse } from "@repo/common/errors"

export const loginHandler = async ({
  body,
  set,
}: {
  body: { email: string; password: string }
  set:  any
}) => {
  const program = Effect.gen(function* () {
    const user = yield* userRepository.findByEmail(body.email)

    if (!user) return yield* Effect.fail(new AuthError("Invalid credentials"))

    const valid = yield* verifyPassword(body.password, user.passwordHash)
    if (!valid) return yield* Effect.fail(new AuthError("Invalid credentials"))

    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId)

    const refreshTokenHash = yield* Effect.tryPromise({
      try:   () => hashToken(tokens.refreshToken),
      catch: () => new AuthError("Internal error"),
    })
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({ id: sessionId, userId: user.id, token: refreshTokenHash, expiresAt })

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  const { user, tokens } = result.value

  if (user.role === "OWNER") {
    writeAuditLog({
      event:    "OWNER_LOGIN",
      actorId:  user.id,
      targetId: user.id,
      meta:     { email: user.email },
    })
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`

  return { user, accessToken: tokens.accessToken }
}

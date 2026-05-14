import { Effect }            from "effect"
import { hashPassword }      from "@/lib/password"
import { issueTokenPair }    from "@/lib/token"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { ConflictError, toErrorResponse } from "@repo/common/errors"

export const registerHandler = async ({
  body,
  set,
}: {
  body: { email: string; name: string; password: string }
  set:  any
}) => {
  const program = Effect.gen(function* () {
    const existing = yield* userRepository.findByEmail(body.email)
    if (existing) return yield* Effect.fail(new ConflictError("email"))

    const passwordHash = yield* hashPassword(body.password)

    const user = yield* userRepository.create({
      email: body.email, name: body.name, passwordHash, role: "CUSTOMER",
    })

    const sessionId = crypto.randomUUID()
    const tokens    = yield* issueTokenPair(user.id, user.role, sessionId)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    yield* sessionRepository.create({ id: sessionId, userId: user.id, token: tokens.refreshToken, expiresAt })

    return { user: { id: user.id, email: user.email, name: user.name }, tokens }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  const { user, tokens } = result.value

  set.status = 201
  set.headers["Set-Cookie"] =
    `ec_refresh=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=${60 * 60 * 24 * 7}`

  return { user, accessToken: tokens.accessToken }
}

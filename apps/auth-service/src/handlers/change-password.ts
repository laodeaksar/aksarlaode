import { Effect }             from "effect"
import { verifyPassword, hashPassword } from "@/lib/password"
import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { AuthError, NotFoundError, ValidationError, toErrorResponse } from "@repo/common/errors"
import { message }           from "@repo/common/response"

export const changePasswordHandler = async ({
  body,
  headers,
  set,
}: {
  body:    { currentPassword: string; newPassword: string }
  headers: Record<string, string | undefined>
  set:     any
}) => {
  const userId = headers["x-user-id"]

  if (!userId) {
    const { body: errBody, status } = toErrorResponse(new AuthError())
    set.status = status
    return errBody
  }

  if (body.newPassword === body.currentPassword) {
    const { body: errBody, status } = toErrorResponse(
      new ValidationError("New password must be different from current password")
    )
    set.status = status
    return errBody
  }

  const program = Effect.gen(function* () {
    const user = yield* userRepository.findById(userId)
    if (!user) return yield* Effect.fail(new NotFoundError("User"))

    const valid = yield* verifyPassword(body.currentPassword, user.passwordHash)
    if (!valid) return yield* Effect.fail(new AuthError("Current password is incorrect"))

    const newHash = yield* hashPassword(body.newPassword)
    yield* userRepository.updatePasswordHash(userId, newHash)

    yield* sessionRepository.deleteAllByUserId(userId)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`

  return message("Password changed. Please log in again.")
}

import { Effect }           from "effect"
import { userRepository }  from "@/repository/user.repository"
import { AuthError, ValidationError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import { ok }              from "@repo/common/response"

export const updateProfileHandler = async ({
  body,
  headers,
  set,
}: {
  body:    { name?: string; phone?: string; avatarUrl?: string }
  headers: Record<string, string | undefined>
  set:     any
}) => {
  const userId = headers["x-user-id"]

  if (!userId) {
    const { body: errBody, status } = toErrorResponse(new AuthError())
    set.status = status
    return errBody
  }

  if (!body.name && !body.phone && !body.avatarUrl) {
    const { body: errBody, status } = toErrorResponse(new ValidationError("At least one field must be provided"))
    set.status = status
    return errBody
  }

  const program = Effect.gen(function* () {
    const updated = yield* userRepository.update(userId, body)
    if (!updated) return yield* Effect.fail(new NotFoundError("User"))

    return {
      id:        updated.id,
      email:     updated.email,
      name:      updated.name,
      phone:     updated.phone     ?? null,
      avatarUrl: updated.avatarUrl ?? null,
      role:      updated.role,
    }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body: errBody, status } = toErrorResponse(result.cause.error)
    set.status = status
    return errBody
  }

  return ok(result.value)
}

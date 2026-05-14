import { Effect }           from "effect"
import { userRepository }  from "@/repository/user.repository"
import { UpdateProfileSchema } from "@repo/common"
import { AuthError, ValidationError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import { ok }              from "@repo/common/response"
import type { HandlerCtx } from "@/types"

export const updateProfileHandler = async ({ body, headers, set }: HandlerCtx) => {
  const userId = headers["x-user-id"]

  if (!userId) {
    const { body: errBody, status } = toErrorResponse(new AuthError())
    set.status = status
    return errBody
  }

  const program = Effect.gen(function* () {
    const input = yield* Effect.try({
      try:   () => UpdateProfileSchema.parse(body),
      catch: () => new ValidationError(),
    })

    const updated = yield* userRepository.update(userId, input)
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

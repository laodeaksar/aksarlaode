import { Effect }          from "effect"
import type { Context }    from "hono"
import { userRepository }  from "@/repository/user.repository"
import { UpdateProfileSchema } from "@repo/common"
import { AuthError, ValidationError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }    from "@/types"

export const updateProfileHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json(toErrorResponse(new AuthError()).body, 401 as any)

  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate & parse input (all fields optional, at least one required)
    const input = yield* Effect.try({
      try:   () => UpdateProfileSchema.parse(body),
      catch: () => new ValidationError(),
    })

    // 2. Persist changes — only columns explicitly provided are updated
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
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  return c.json({ user: result.value })
}

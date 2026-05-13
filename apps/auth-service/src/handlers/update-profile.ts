import { Effect }          from "effect"
import type { Context }    from "hono"
import { userRepository }  from "@/repository/user.repository"
import { UpdateProfileSchema } from "@repo/common"
import type { AppEnv }    from "@/types"

export const updateProfileHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json({ error: "Unauthorized" }, 401)

  const body = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate & parse input (all fields optional, at least one required)
    const input = yield* Effect.try({
      try:   () => UpdateProfileSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    // 2. Persist changes — only columns explicitly provided are updated
    const updated = yield* userRepository.update(userId, input)
    if (!updated) {
      return yield* Effect.fail({ _tag: "NotFoundError" as const })
    }

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
    const err = result.cause.error as { _tag: string }
    if (err._tag === "ValidationError") return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "NotFoundError")   return c.json({ error: "User not found" }, 404)
    return c.json({ error: "Update failed" }, 500)
  }

  return c.json({ user: result.value })
}

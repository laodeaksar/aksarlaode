import { Effect }           from "effect"
import type { Context }     from "hono"
import { sessionRepository } from "@/repository/session.repository"
import type { AppEnv }      from "@/types"

export const revokeSessionHandler = async (c: Context<AppEnv>) => {
  const userId    = c.req.header("x-user-id")
  const sessionId = c.req.param("id")

  if (!userId) return c.json({ error: "Unauthorized" }, 401)
  if (!sessionId) return c.json({ error: "Session ID required" }, 400)

  const program = Effect.gen(function* () {
    // Verify the session exists AND belongs to this user before deleting
    const session = yield* sessionRepository.findByIdAndUserId(sessionId, userId)
    if (!session) {
      return yield* Effect.fail({ _tag: "NotFoundError" as const })
    }
    yield* sessionRepository.deleteByIdAndUserId(sessionId, userId)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "NotFoundError") return c.json({ error: "Session not found" }, 404)
    return c.json({ error: "Failed to revoke session" }, 500)
  }

  return c.json({ message: "Session revoked" })
}

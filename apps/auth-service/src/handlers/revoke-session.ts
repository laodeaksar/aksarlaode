import { Effect }             from "effect"
import type { Context }       from "hono"
import { sessionRepository }  from "@/repository/session.repository"
import { AuthError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }        from "@/types"

export const revokeSessionHandler = async (c: Context<AppEnv>) => {
  const userId    = c.req.header("x-user-id")
  const sessionId = c.req.param("id")

  if (!userId)    return c.json(toErrorResponse(new AuthError()).body, 401 as any)
  if (!sessionId) return c.json(toErrorResponse(new AuthError("Session ID required")).body, 400 as any)

  const program = Effect.gen(function* () {
    // Verify the session exists AND belongs to this user before deleting
    const session = yield* sessionRepository.findByIdAndUserId(sessionId, userId)
    if (!session) return yield* Effect.fail(new NotFoundError("Session"))
    yield* sessionRepository.deleteByIdAndUserId(sessionId, userId)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  return c.json({ message: "Session revoked" })
}

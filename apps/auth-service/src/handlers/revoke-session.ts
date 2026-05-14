import { Effect }            from "effect"
import { sessionRepository } from "@/repository/session.repository"
import { AuthError, NotFoundError, toErrorResponse } from "@repo/common/errors"
import { message }           from "@repo/common/response"
import type { HandlerCtx }   from "@/types"

export const revokeSessionHandler = async ({ headers, params, set }: HandlerCtx) => {
  const userId    = headers["x-user-id"]
  const sessionId = params["id"]

  if (!userId) {
    const { body, status } = toErrorResponse(new AuthError())
    set.status = status
    return body
  }

  if (!sessionId) {
    const { body, status } = toErrorResponse(new AuthError("Session ID required"))
    set.status = status
    return body
  }

  const program = Effect.gen(function* () {
    const session = yield* sessionRepository.findByIdAndUserId(sessionId, userId)
    if (!session) return yield* Effect.fail(new NotFoundError("Session"))
    yield* sessionRepository.deleteByIdAndUserId(sessionId, userId)
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    set.status = status
    return body
  }

  return message("Session revoked")
}

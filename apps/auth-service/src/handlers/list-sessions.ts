import { Effect }            from "effect"
import { sessionRepository } from "@/repository/session.repository"
import { AuthError, toErrorResponse } from "@repo/common/errors"
import { paginated }         from "@repo/common/response"
import type { HandlerCtx }   from "@/types"

export const listSessionsHandler = async ({ headers, query, set }: HandlerCtx) => {
  const userId = headers["x-user-id"]

  if (!userId) {
    const { body, status } = toErrorResponse(new AuthError())
    set.status = status
    return body
  }

  const page  = Math.max(1, Number(query["page"]  ?? 1))
  const limit = Math.min(50, Math.max(1, Number(query["limit"] ?? 20)))

  const result = await Effect.runPromiseExit(
    sessionRepository.findAllByUserId(userId)
  )

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    set.status = status
    return body
  }

  const all = result.value.map(s => ({
    id:        s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }))

  const total = all.length
  const slice = all.slice((page - 1) * limit, page * limit)

  return paginated(slice, { page, limit, total })
}

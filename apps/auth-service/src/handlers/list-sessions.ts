import { Effect }            from "effect"
import { sessionRepository } from "@/repository/session.repository"
import { AuthError, toErrorResponse } from "@repo/common/errors"
import { paginated }         from "@repo/common/response"

export const listSessionsHandler = async ({
  headers,
  query,
  set,
}: {
  headers: Record<string, string | undefined>
  query:   { page?: number; limit?: number }
  set:     any
}) => {
  const userId = headers["x-user-id"]

  if (!userId) {
    const { body, status } = toErrorResponse(new AuthError())
    set.status = status
    return body
  }

  const page   = Math.max(1, query.page  ?? 1)
  const limit  = Math.min(50, Math.max(1, query.limit ?? 20))
  const offset = (page - 1) * limit

  const result = await Effect.runPromiseExit(
    sessionRepository.findPageByUserId(userId, { limit, offset })
  )

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    set.status = status
    return body
  }

  const { items, total } = result.value

  return paginated(items, { page, limit, total })
}

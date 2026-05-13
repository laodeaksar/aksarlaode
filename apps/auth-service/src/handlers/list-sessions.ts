import { Effect }             from "effect"
import type { Context }       from "hono"
import { sessionRepository }  from "@/repository/session.repository"
import { AuthError, toErrorResponse } from "@repo/common/errors"
import { paginated }          from "@repo/common/response"
import type { AppEnv }        from "@/types"

export const listSessionsHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json(toErrorResponse(new AuthError()).body, 401 as any)

  // Optional pagination query params
  const page  = Math.max(1, Number(c.req.query("page")  ?? 1))
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)))

  const result = await Effect.runPromiseExit(
    sessionRepository.findAllByUserId(userId)
  )

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  // Strip raw refresh token — only expose safe metadata
  const all = result.value.map(s => ({
    id:        s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }))

  const total = all.length
  const slice = all.slice((page - 1) * limit, page * limit)

  return c.json(paginated(slice, { page, limit, total }))
}

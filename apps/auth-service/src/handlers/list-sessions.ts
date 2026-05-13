import { Effect }             from "effect"
import type { Context }       from "hono"
import { sessionRepository }  from "@/repository/session.repository"
import { AuthError, toErrorResponse } from "@repo/common/errors"
import type { AppEnv }        from "@/types"

export const listSessionsHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json(toErrorResponse(new AuthError()).body, 401 as any)

  const result = await Effect.runPromiseExit(
    sessionRepository.findAllByUserId(userId)
  )

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error)
    return c.json(body, status as any)
  }

  // Strip raw refresh token — only expose safe metadata
  const sessions = result.value.map(s => ({
    id:        s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }))

  return c.json({ sessions })
}

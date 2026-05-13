import { Effect }           from "effect"
import type { Context }     from "hono"
import { sessionRepository } from "@/repository/session.repository"
import type { AppEnv }      from "@/types"

export const listSessionsHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  if (!userId) return c.json({ error: "Unauthorized" }, 401)

  const result = await Effect.runPromiseExit(
    sessionRepository.findAllByUserId(userId)
  )

  if (result._tag === "Failure") {
    return c.json({ error: "Failed to load sessions" }, 500)
  }

  // Strip the raw refresh token — only expose safe metadata
  const sessions = result.value.map(s => ({
    id:        s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }))

  return c.json({ sessions })
}

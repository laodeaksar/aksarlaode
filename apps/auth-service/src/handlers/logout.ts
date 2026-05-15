import { Effect }            from "effect"
import { hashToken }         from "@/lib/token-hash"
import { sessionRepository } from "@/repository/session.repository"
import { denySession }       from "@/lib/session-denylist"
import { writeAuditLog }     from "@/lib/audit-log"
import { message }           from "@repo/common/response"
import type { HandlerCtx }   from "@/types"

export const logoutHandler = async ({ headers, set }: HandlerCtx) => {
  const userId       = headers["x-user-id"]
  const sessionId    = headers["x-session-id"]   // forwarded by api-gateway contextInjector
  const cookieHeader = headers["cookie"] ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const refreshToken = match?.[1] ? decodeURIComponent(match[1]) : null

  // ── 1. Delete the refresh token session from DB ───────────────────────────
  if (refreshToken) {
    const tokenHash = await hashToken(refreshToken).catch(() => null)
    if (tokenHash) {
      await Effect.runPromise(
        sessionRepository.deleteByToken(tokenHash).pipe(Effect.orElse(() => Effect.void))
      )
    }
  }

  // ── 2. Add sessionId to denylist so any in-flight access token is also
  //       immediately invalidated (within the 5-minute access token TTL).
  //       Fire-and-forget: a Redis error is logged but must not block logout.
  if (sessionId) {
    await denySession(sessionId)
  }

  if (userId) {
    writeAuditLog({
      event:    "LOGOUT",
      actorId:  userId,
      targetId: userId,
    })
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0`

  return message("Logged out")
}

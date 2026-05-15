import { Effect }            from "effect"
import { hashToken }         from "@/lib/token-hash"
import { sessionRepository } from "@/repository/session.repository"
import { message }           from "@repo/common/response"
import type { HandlerCtx }   from "@/types"

export const logoutHandler = async ({ headers, set }: HandlerCtx) => {
  const cookieHeader = headers["cookie"] ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const refreshToken = match?.[1] ? decodeURIComponent(match[1]) : null

  if (refreshToken) {
    const tokenHash = await hashToken(refreshToken).catch(() => null)
    if (tokenHash) {
      await Effect.runPromise(
        sessionRepository.deleteByToken(tokenHash).pipe(Effect.orElse(() => Effect.void))
      )
    }
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0`

  return message("Logged out")
}

import { Effect }            from "effect"
import { sessionRepository } from "@/repository/session.repository"
import { message }           from "@repo/common/response"
import type { HandlerCtx }   from "@/types"

export const logoutHandler = async ({ headers, set }: HandlerCtx) => {
  const cookieHeader = headers["cookie"] ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const refreshToken = match?.[1] ? decodeURIComponent(match[1]) : null

  if (refreshToken) {
    await Effect.runPromise(
      sessionRepository.deleteByToken(refreshToken).pipe(Effect.orElse(() => Effect.void))
    )
  }

  set.headers["Set-Cookie"] =
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`

  return message("Logged out")
}

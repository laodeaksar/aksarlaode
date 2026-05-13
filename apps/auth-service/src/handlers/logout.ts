import { Effect }             from "effect"
import type { Context }       from "hono"
import { sessionRepository }  from "@/repository/session.repository"
import { message }            from "@repo/common/response"
import type { AppEnv }        from "@/types"

export const logoutHandler = async (c: Context<AppEnv>) => {
  const cookieHeader = c.req.header("cookie") ?? ""
  const match        = cookieHeader.match(/ec_refresh=([^;]+)/)
  const refreshToken = match?.[1] ? decodeURIComponent(match[1]) : null

  if (refreshToken) {
    // Best-effort: invalidate session in DB, ignore errors
    await Effect.runPromise(
      sessionRepository.deleteByToken(refreshToken).pipe(Effect.orElse(() => Effect.void))
    )
  }

  c.header("Set-Cookie",
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`
  )
  return c.json(message("Logged out"))
}

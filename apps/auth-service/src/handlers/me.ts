import type { Context }   from "hono"
import { ok }             from "@repo/common/response"
import { toErrorResponse, AuthError } from "@repo/common/errors"
import type { AppEnv }   from "@/types"

export const meHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  const role   = c.req.header("x-user-role")

  if (!userId) return c.json(toErrorResponse(new AuthError()).body, 401 as any)

  return c.json(ok({ id: userId, role: role ?? "CUSTOMER" }))
}

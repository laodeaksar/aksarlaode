import { ok }                from "@repo/common/response"
import { toErrorResponse, AuthError } from "@repo/common/errors"
import type { HandlerCtx }   from "@/types"

export const meHandler = async ({ headers, set }: HandlerCtx) => {
  const userId = headers["x-user-id"]
  const role   = headers["x-user-role"]

  if (!userId) {
    const { body, status } = toErrorResponse(new AuthError())
    set.status = status
    return body
  }

  return ok({ id: userId, role: role ?? "CUSTOMER" })
}

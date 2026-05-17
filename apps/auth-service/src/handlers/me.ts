import type { HandlerCtx } from "@/types"

import { AuthError, toErrorResponse } from "@repo/common/errors"
import { ok } from "@repo/common/response"

export const meHandler = async ({ headers, set }: HandlerCtx) => {
  const userId = headers["x-user-id"]
  const role = headers["x-user-role"]

  if (!userId) {
    const { body, status } = toErrorResponse(new AuthError())
    set.status = status
    return body
  }

  return ok({ id: userId, role: role ?? "CUSTOMER" })
}

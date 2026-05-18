import type { MiddlewareHandler } from "hono"

import type { AppEnv } from "@/types/context"
import { getClientIp } from "@/lib/client-ip"

export const logger: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { method, path } = c.req
  const requestId = c.var.requestId

  console.info(
    JSON.stringify({
      event: "request_in",
      requestId,
      method,
      path,
      ip: getClientIp(c), // C-05: was missing .split(",")[0].trim() and "unknown" fallback
      userAgent: c.req.header("user-agent"),
    })
  )

  await next()

  const duration = Date.now() - c.var.startTime
  console.info(
    JSON.stringify({
      event: "request_out",
      requestId,
      status: c.res.status,
      duration,
    })
  )
}

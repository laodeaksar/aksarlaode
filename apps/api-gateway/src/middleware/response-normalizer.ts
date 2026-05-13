import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types/context"

export const responseNormalizer: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next()

  const duration = Date.now() - c.var.startTime
  c.header("x-request-id",    c.var.requestId)
  c.header("x-response-time", `${duration}ms`)
}

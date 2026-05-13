import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "@/types/context"

export const logger: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { method, path } = c.req
  const requestId = c.var.requestId

  console.info(JSON.stringify({
    event: "request_in",
    requestId,
    method,
    path,
    ip:        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
    userAgent: c.req.header("user-agent"),
  }))

  await next()

  const duration = Date.now() - c.var.startTime
  console.info(JSON.stringify({
    event:  "request_out",
    requestId,
    status: c.res.status,
    duration,
  }))
}

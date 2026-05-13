import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types/context"

export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = c.req.header("x-request-id") ?? crypto.randomUUID()
  c.set("requestId", id)
  c.set("startTime", Date.now())
  await next()
}

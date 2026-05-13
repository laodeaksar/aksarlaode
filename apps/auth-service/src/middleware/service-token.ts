import type { MiddlewareHandler } from "hono"
import { env }                    from "@repo/env"

export const serviceTokenMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("x-service-token")
  if (token !== env.INTERNAL_SERVICE_TOKEN) {
    return c.json({ error: "Forbidden" }, 403)
  }
  return next()
}

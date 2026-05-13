import type { MiddlewareHandler } from "hono"
import type { AppEnv }           from "@/types/context"

export const contextInjector: MiddlewareHandler<AppEnv> = async (c, next) => {
  const payload = c.var.authPayload as any

  if (payload && payload.sub && payload.role) {
    c.set("user", {
      id:        payload.sub,
      role:      payload.role,
      sessionId: payload.sessionId ?? "",
    })
  } else {
    c.set("user", null)
  }

  await next()
}

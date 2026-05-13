import type { MiddlewareHandler } from "hono"
import type { AppEnv, User }     from "@/types/context"

// Promotes the authPayload (set by authResolver) into a fully-typed User.
//
// authResolver sets authPayload to one of:
//   null              — public route, no auth needed
//   User              — valid JWT (verifyJwt already returns { id, role, sessionId })
//   { type: "webhook" } — HMAC-verified Midtrans webhook
export const contextInjector: MiddlewareHandler<AppEnv> = async (c, next) => {
  const payload = c.var.authPayload as User | { type: "webhook" } | null

  if (payload && "id" in payload && payload.id && payload.role) {
    c.set("user", {
      id:        payload.id,
      role:      payload.role,
      sessionId: payload.sessionId ?? "",
    })
  } else {
    c.set("user", null)
  }

  await next()
}

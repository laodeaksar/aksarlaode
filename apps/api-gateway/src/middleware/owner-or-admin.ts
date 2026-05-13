import type { MiddlewareHandler } from "hono"
import { env }                    from "@repo/env/gateway"
import type { AppEnv }            from "@/types/context"

// Fetches the order owner from order-service and compares to the requesting user.
// Admins bypass the check and pass through immediately.
export const ownerOrAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user    = c.var.user
  const orderId = c.req.param("id")

  if (!user) {
    return c.json(
      { error: "Unauthorized", code: "UNAUTHORIZED", requestId: c.var.requestId },
      401
    )
  }

  if (user.role === "ADMIN") return next()

  // Forward a lightweight ownership check to order-service
  try {
    const res = await fetch(`${env.ORDER_SERVICE_URL}/orders/${orderId}/owner`, {
      headers: {
        "x-user-id":       user.id,
        "x-service-token": env.INTERNAL_SERVICE_TOKEN,
        "x-request-id":   c.var.requestId,
      },
    })

    if (!res.ok) {
      return c.json(
        { error: "Forbidden", code: "FORBIDDEN", requestId: c.var.requestId },
        403
      )
    }
  } catch {
    return c.json(
      { error: "Service unavailable", code: "UPSTREAM_ERROR", requestId: c.var.requestId },
      502
    )
  }

  await next()
}

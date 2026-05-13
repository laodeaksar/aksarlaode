import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types/context"

// Fetches orderId from path, verifies c.var.user.id matches
// or passes through if role is ADMIN
export const ownerOrAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user    = c.var.user
  const orderId = c.req.param("id")

  if (!user) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401)
  }

  if (user.role === "ADMIN") return next()

  // Forward a lightweight ownership check to order-service
  const res = await fetch(
    `${process.env.ORDER_SERVICE_URL}/orders/${orderId}/owner`,
    {
      headers: {
        "x-user-id":      user.id,
        "x-service-token": process.env.INTERNAL_SERVICE_TOKEN!,
      }
    }
  )

  if (!res.ok) {
    return c.json({ error: "Forbidden", code: "FORBIDDEN" }, 403)
  }

  await next()
}

import type { MiddlewareHandler } from "hono"

import type { AppEnv } from "@/types/context"
import { ROLE_HIERARCHY, ROUTE_PERMISSIONS } from "@/lib/route-permissions"

export const routeGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.var.user
  if (!user) return next() // public / webhook, already resolved

  const { path, method } = c.req

  for (const rule of ROUTE_PERMISSIONS) {
    if (!rule.pattern.test(path)) continue
    if (rule.method !== "*" && rule.method !== method) continue

    const userLevel = ROLE_HIERARCHY[user.role] ?? -1
    const minLevel = ROLE_HIERARCHY[rule.minRole]

    if (userLevel < minLevel) {
      return c.json(
        { error: "Forbidden", code: "FORBIDDEN", requestId: c.var.requestId },
        403
      )
    }

    break // first matching rule wins
  }

  await next()
}

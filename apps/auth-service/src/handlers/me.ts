import type { Context } from "hono"
import type { AppEnv }  from "../types"

export const meHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")
  const role   = c.req.header("x-user-role")

  if (!userId) return c.json({ error: "Unauthorized" }, 401)

  return c.json({ id: userId, role: role ?? "CUSTOMER" })
}

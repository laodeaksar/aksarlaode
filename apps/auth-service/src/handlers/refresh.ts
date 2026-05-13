import type { Context } from "hono"
import type { AppEnv }  from "@/types"

export const refreshHandler = async (c: Context<AppEnv>) => {
  return c.json({ error: "Not implemented" }, 501)
}

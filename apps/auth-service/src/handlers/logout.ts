import type { Context } from "hono"
import type { AppEnv }  from "@/types"

export const logoutHandler = async (c: Context<AppEnv>) => {
  c.header("Set-Cookie",
    `ec_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0`
  )
  return c.json({ message: "Logged out" })
}

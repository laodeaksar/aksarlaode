import type { Context } from "hono"
import type { AppEnv } from "@/types"

export const releaseStockHandler = async (c: Context<AppEnv>) => {
  const orderId = c.req.param("orderId")
  return c.json({ message: "Stock released", orderId })
}

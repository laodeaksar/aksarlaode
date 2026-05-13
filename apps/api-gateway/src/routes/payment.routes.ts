import { Hono } from "hono"
import { proxyTo } from "../proxy/proxy"
import type { AppEnv } from "../types/context"

const router = new Hono<AppEnv>()

router.post("/initiate",     (c) => proxyTo("PAYMENT", c))  // create Midtrans tx
router.get("/:orderId",      (c) => proxyTo("PAYMENT", c))  // payment status
router.post("/:orderId/retry",(c) => proxyTo("PAYMENT", c)) // retry failed payment

export default router

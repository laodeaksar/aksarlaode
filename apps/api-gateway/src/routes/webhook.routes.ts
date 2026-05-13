import { Hono } from "hono"
import { proxyTo } from "../proxy/proxy"
import type { AppEnv } from "../types/context"

const router = new Hono<AppEnv>()

// Midtrans posts here after payment status change
router.post("/midtrans", (c) => proxyTo("PAYMENT", c))

export default router

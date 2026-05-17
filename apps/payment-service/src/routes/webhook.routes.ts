import { webhookHandler } from "@/handlers/webhook"
import type { AppEnv } from "@/types"
import { Hono } from "hono"

const router = new Hono<AppEnv>()

router.post("/midtrans", webhookHandler)

export default router

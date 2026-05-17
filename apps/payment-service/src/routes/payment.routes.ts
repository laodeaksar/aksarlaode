import { initiateHandler } from "@/handlers/initiate"
import { statusHandler } from "@/handlers/status"
import type { AppEnv } from "@/types"
import { Hono } from "hono"

const router = new Hono<AppEnv>()

router.post("/", initiateHandler)
router.get("/:orderId/status", statusHandler)

export default router

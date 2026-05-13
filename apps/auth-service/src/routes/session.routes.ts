import { Hono }                from "hono"
import { listSessionsHandler } from "@/handlers/list-sessions"
import { revokeSessionHandler } from "@/handlers/revoke-session"
import { serviceTokenMiddleware } from "@/middleware/service-token"
import type { AppEnv }         from "@/types"

const router = new Hono<AppEnv>()

// All session routes require a valid internal service token +
// x-user-id header (set by the API gateway after JWT verification)
router.use("/*", serviceTokenMiddleware)

router.get("/",       listSessionsHandler)
router.delete("/:id", revokeSessionHandler)

export default router

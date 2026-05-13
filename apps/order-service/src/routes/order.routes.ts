import { Hono }                from "hono"
import { createHandler }       from "../handlers/create"
import { listHandler }         from "../handlers/list"
import { getOneHandler }       from "../handlers/get-one"
import { cancelHandler }       from "../handlers/cancel"
import { updateStatusHandler } from "../handlers/update-status"
import { releaseStockHandler } from "../handlers/release-stock"
import type { AppEnv }         from "../types"

const router = new Hono<AppEnv>()

router.post("/",                         createHandler)
router.get("/",                          listHandler)
router.get("/:orderId",                  getOneHandler)
router.post("/:orderId/cancel",          cancelHandler)
router.patch("/:orderId/status",         updateStatusHandler)
router.post("/:orderId/release-stock",   releaseStockHandler)

export default router

import { Hono } from "hono"
import { proxyTo } from "../proxy/proxy"
import type { AppEnv } from "../types/context"

const router = new Hono<AppEnv>()

// Public reads
router.get("/",        (c) => proxyTo("PRODUCT", c))   // list + filter + search
router.get("/:id",     (c) => proxyTo("PRODUCT", c))   // single product
router.get("/slug/:slug", (c) => proxyTo("PRODUCT", c))

// Admin writes (routeGuard enforces ADMIN role)
router.post("/",          (c) => proxyTo("PRODUCT", c))
router.put("/:id",        (c) => proxyTo("PRODUCT", c))
router.patch("/:id",      (c) => proxyTo("PRODUCT", c))
router.delete("/:id",     (c) => proxyTo("PRODUCT", c))
router.post("/:id/images",(c) => proxyTo("PRODUCT", c))

export default router

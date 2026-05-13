import { Hono } from "hono"
import { proxyTo } from "../proxy/proxy"
import type { AppEnv } from "../types/context"

const router = new Hono<AppEnv>()

// Public — authResolver already skips these
router.post("/login",         (c) => proxyTo("AUTH", c))
router.post("/register",      (c) => proxyTo("AUTH", c))
router.post("/refresh",       (c) => proxyTo("AUTH", c))

// Protected
router.post("/logout",        (c) => proxyTo("AUTH", c))
router.get("/me",             (c) => proxyTo("AUTH", c))
router.patch("/me",           (c) => proxyTo("AUTH", c))
router.post("/change-password", (c) => proxyTo("AUTH", c))

export default router

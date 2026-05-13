import { Hono }    from "hono"
import { proxyTo } from "@/proxy/proxy"
import type { AppEnv } from "@/types/context"

const router = new Hono<AppEnv>()

// ── Public (authResolver skips JWT for these) ─────────────────────────────────
router.post("/login",           (c) => proxyTo("AUTH", c))
router.post("/register",        (c) => proxyTo("AUTH", c))
router.post("/refresh",         (c) => proxyTo("AUTH", c))
router.post("/forgot-password", (c) => proxyTo("AUTH", c))
router.post("/reset-password",  (c) => proxyTo("AUTH", c))

// ── Protected — requires valid JWT ────────────────────────────────────────────
router.post("/logout",          (c) => proxyTo("AUTH", c))
router.get("/me",               (c) => proxyTo("AUTH", c))
router.patch("/me",             (c) => proxyTo("AUTH", c))
router.post("/change-password", (c) => proxyTo("AUTH", c))

// ── Session management ────────────────────────────────────────────────────────
router.get("/sessions",         (c) => proxyTo("AUTH", c))   // list active sessions
router.delete("/sessions/:id",  (c) => proxyTo("AUTH", c))   // revoke specific session

export default router

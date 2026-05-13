import { Hono }            from "hono"
import { loginHandler }         from "@/handlers/login"
import { registerHandler }      from "@/handlers/register"
import { logoutHandler }        from "@/handlers/logout"
import { meHandler }            from "@/handlers/me"
import { refreshHandler }       from "@/handlers/refresh"
import { updateProfileHandler }  from "@/handlers/update-profile"
import { changePasswordHandler } from "@/handlers/change-password"
import { serviceTokenMiddleware }            from "@/middleware/service-token"
import { loginRateLimiter, registerRateLimiter } from "@/middleware/rate-limit"
import type { AppEnv }     from "@/types"

const router = new Hono<AppEnv>()

router.post("/login",    loginRateLimiter,    loginHandler)
router.post("/register", registerRateLimiter, registerHandler)
router.post("/logout",   logoutHandler)
router.get("/me",        serviceTokenMiddleware, meHandler)
router.patch("/me",              serviceTokenMiddleware, updateProfileHandler)
router.post("/change-password",  serviceTokenMiddleware, changePasswordHandler)
router.post("/refresh",          refreshHandler)

export default router

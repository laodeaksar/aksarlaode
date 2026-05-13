import { Hono }           from "hono"
import { loginHandler }   from "../handlers/login"
import { registerHandler } from "../handlers/register"
import { logoutHandler }  from "../handlers/logout"
import { meHandler }      from "../handlers/me"
import { refreshHandler } from "../handlers/refresh"
import type { AppEnv }    from "../types"

const router = new Hono<AppEnv>()

router.post("/login",    loginHandler)
router.post("/register", registerHandler)
router.post("/logout",   logoutHandler)
router.get("/me",        meHandler)
router.post("/refresh",  refreshHandler)

export default router

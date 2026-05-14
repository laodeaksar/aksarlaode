import { Elysia }                   from "elysia"
import { loginHandler }              from "@/handlers/login"
import { registerHandler }           from "@/handlers/register"
import { logoutHandler }             from "@/handlers/logout"
import { meHandler }                 from "@/handlers/me"
import { refreshHandler }            from "@/handlers/refresh"
import { updateProfileHandler }      from "@/handlers/update-profile"
import { changePasswordHandler }     from "@/handlers/change-password"
import { forgotPasswordHandler }     from "@/handlers/forgot-password"
import { resetPasswordHandler }      from "@/handlers/reset-password"
import { loginRateLimiter, registerRateLimiter, forgotPasswordRateLimiter } from "@/middleware/rate-limit"

const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login",           loginHandler,           { beforeHandle: loginRateLimiter })
  .post("/register",        registerHandler,        { beforeHandle: registerRateLimiter })
  .post("/logout",          logoutHandler)
  .get("/me",               meHandler)
  .patch("/me",             updateProfileHandler)
  .post("/change-password", changePasswordHandler)
  .post("/forgot-password", forgotPasswordHandler,  { beforeHandle: forgotPasswordRateLimiter })
  .post("/reset-password",  resetPasswordHandler)
  .post("/refresh",         refreshHandler)

export default authRoutes

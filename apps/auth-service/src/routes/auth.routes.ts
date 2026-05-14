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
import {
  LoginBody,
  RegisterBody,
  UpdateProfileBody,
  ChangePasswordBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@/schemas"

const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login",           loginHandler,           { beforeHandle: loginRateLimiter,          body: LoginBody })
  .post("/register",        registerHandler,        { beforeHandle: registerRateLimiter,       body: RegisterBody })
  .post("/logout",          logoutHandler)
  .get("/me",               meHandler)
  .patch("/me",             updateProfileHandler,                                             { body: UpdateProfileBody })
  .post("/change-password", changePasswordHandler,                                           { body: ChangePasswordBody })
  .post("/forgot-password", forgotPasswordHandler,  { beforeHandle: forgotPasswordRateLimiter, body: ForgotPasswordBody })
  .post("/reset-password",  resetPasswordHandler,                                            { body: ResetPasswordBody })
  .post("/refresh",         refreshHandler)

export default authRoutes

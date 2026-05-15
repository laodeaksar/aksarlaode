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
import { transferOwnershipHandler }  from "@/handlers/transfer-ownership"
import {
  loginRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
  changePasswordRateLimiter,
  resetPasswordRateLimiter,
  refreshRateLimiter,
} from "@/middleware/rate-limit"
import {
  LoginBody,
  RegisterBody,
  UpdateProfileBody,
  ChangePasswordBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  TransferOwnershipBody,
} from "@/schemas"

const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login",           loginHandler,           { beforeHandle: loginRateLimiter,          body: LoginBody })
  .post("/register",        registerHandler,        { beforeHandle: registerRateLimiter,       body: RegisterBody })
  .post("/logout",          logoutHandler)
  .get("/me",               meHandler)
  .patch("/me",             updateProfileHandler,                                             { body: UpdateProfileBody })
  .post("/change-password", changePasswordHandler,  { beforeHandle: changePasswordRateLimiter,  body: ChangePasswordBody })
  .post("/forgot-password", forgotPasswordHandler,  { beforeHandle: forgotPasswordRateLimiter,  body: ForgotPasswordBody })
  .post("/reset-password",  resetPasswordHandler,   { beforeHandle: resetPasswordRateLimiter,   body: ResetPasswordBody })
  .post("/refresh",         refreshHandler,         { beforeHandle: refreshRateLimiter })

  // ── OWNER-only routes ───────────────────────────────────────────────────
  // Gateway enforces minRole: "OWNER" for /auth/owner/* via ROUTE_PERMISSIONS
  .post("/owner/transfer",  transferOwnershipHandler,                                        { body: TransferOwnershipBody })

export default authRoutes

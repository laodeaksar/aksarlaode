import { Elysia } from "elysia";

import { changePasswordHandler } from "@/handlers/change-password";
import { forgotPasswordHandler } from "@/handlers/forgot-password";
import { loginHandler } from "@/handlers/login";
import { logoutHandler } from "@/handlers/logout";
import { meHandler } from "@/handlers/me";
import { refreshHandler } from "@/handlers/refresh";
import { registerHandler } from "@/handlers/register";
import { resetPasswordHandler } from "@/handlers/reset-password";
import { transferOwnershipHandler } from "@/handlers/transfer-ownership";
import { updateProfileHandler } from "@/handlers/update-profile";
import {
  changePasswordRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter,
} from "@/middleware/rate-limit";
import {
  ChangePasswordBody,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  TransferOwnershipBody,
  UpdateProfileBody,
} from "@/schemas";

const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/login", loginHandler, {
    beforeHandle: loginRateLimiter,
    body: LoginBody,
    detail: {
      tags: ["Auth"],
      summary: "Login",
      description:
        "Authenticates a user with email and password. Returns a short-lived access token and sets a `refresh_token` HttpOnly cookie. Rate-limited.",
    },
  })
  .post("/register", registerHandler, {
    beforeHandle: registerRateLimiter,
    body: RegisterBody,
    detail: {
      tags: ["Auth"],
      summary: "Register",
      description:
        "Creates a new CUSTOMER account. Email must be unique. Rate-limited.",
    },
  })
  .post("/logout", logoutHandler, {
    detail: {
      tags: ["Auth"],
      summary: "Logout",
      description:
        "Invalidates the current session and clears the `refresh_token` cookie. Requires a valid Bearer token.",
    },
  })
  .get("/me", meHandler, {
    detail: {
      tags: ["Auth"],
      summary: "Get current user",
      description:
        "Returns the authenticated user's profile. Requires a valid Bearer token.",
    },
  })
  .patch("/me", updateProfileHandler, {
    body: UpdateProfileBody,
    detail: {
      tags: ["Auth"],
      summary: "Update profile",
      description:
        "Updates name, phone, and/or avatarUrl for the authenticated user. avatarUrl must be an HTTPS URL from an approved domain. Requires a valid Bearer token.",
    },
  })
  .post("/change-password", changePasswordHandler, {
    beforeHandle: changePasswordRateLimiter,
    body: ChangePasswordBody,
    detail: {
      tags: ["Auth"],
      summary: "Change password",
      description:
        "Changes the authenticated user's password. Requires the current password as confirmation. All existing sessions are invalidated on success. Rate-limited.",
    },
  })
  .post("/forgot-password", forgotPasswordHandler, {
    beforeHandle: forgotPasswordRateLimiter,
    body: ForgotPasswordBody,
    detail: {
      tags: ["Auth"],
      summary: "Request password reset",
      description:
        "Sends a one-time password-reset link to the provided email. Always returns 200 to avoid user enumeration. Rate-limited.",
    },
  })
  .post("/reset-password", resetPasswordHandler, {
    beforeHandle: resetPasswordRateLimiter,
    body: ResetPasswordBody,
    detail: {
      tags: ["Auth"],
      summary: "Reset password",
      description:
        "Resets the user's password using a valid single-use token from the reset email. Token expires after a short TTL. Rate-limited.",
    },
  })
  .post("/refresh", refreshHandler, {
    beforeHandle: refreshRateLimiter,
    detail: {
      tags: ["Auth"],
      summary: "Refresh access token",
      description:
        "Issues a new short-lived access token using the `refresh_token` HttpOnly cookie. Rate-limited.",
    },
  })

  // ── OWNER-only routes ───────────────────────────────────────────────────
  // Gateway enforces minRole: "OWNER" for /auth/owner/* via ROUTE_PERMISSIONS
  .post("/owner/transfer", transferOwnershipHandler, {
    body: TransferOwnershipBody,
    detail: {
      tags: ["Owner"],
      summary: "Transfer ownership",
      description:
        "Atomically promotes `targetUserId` to OWNER and demotes the current OWNER to ADMIN. Requires re-authentication via `currentPassword`. Only the current OWNER may call this endpoint.",
    },
  });

export default authRoutes;

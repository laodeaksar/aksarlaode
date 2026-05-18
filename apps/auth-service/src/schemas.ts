import { FormatRegistry } from "@sinclair/typebox";
import { t } from "elysia";

import { ALLOWED_AVATAR_HOSTS, isAllowedAvatarUrl } from "@/lib/avatar";

// Register a custom TypeBox format that mirrors the Zod isAllowedAvatarUrl
// rules: HTTPS only, domain allowlist, no raw IPs, no internal hostnames.
// Registering here (module load time) ensures the format is available before
// any Elysia route parses a request body.
FormatRegistry.Set("avatar-url", (value) => isAllowedAvatarUrl(value));

export const LoginBody = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 }),
});

export const RegisterBody = t.Object({
  email: t.String({ format: "email" }),
  name: t.String({ minLength: 2, maxLength: 100 }),
  password: t.String({ minLength: 8, maxLength: 72 }),
});

export const UpdateProfileBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  phone: t.Optional(t.String({ minLength: 7, maxLength: 20 })),
  avatarUrl: t.Optional(
    t.String({
      format: "avatar-url",
      maxLength: 500,
      description:
        `HTTPS URL pointing to the user's avatar image. ` +
        `Must come from an allowed host: ${ALLOWED_AVATAR_HOSTS}. ` +
        `Raw IP addresses, localhost, and cloud metadata endpoints are always rejected.`,
    })
  ),
});

export const ChangePasswordBody = t.Object({
  currentPassword: t.String({ minLength: 1 }),
  newPassword: t.String({ minLength: 8, maxLength: 72 }),
});

export const ForgotPasswordBody = t.Object({
  email: t.String({ format: "email" }),
});

export const ResetPasswordBody = t.Object({
  // Reset tokens are always 32 CSPRNG bytes encoded as 64 lowercase hex chars.
  // Rejecting other formats at the schema layer avoids a DB round-trip for
  // obviously invalid input (arbitrary strings, path traversal attempts, etc.).
  token: t.String({ minLength: 64, maxLength: 64, pattern: "^[0-9a-f]{64}$" }),
  newPassword: t.String({ minLength: 8, maxLength: 72 }),
});

export const SessionQuery = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export const TransferOwnershipBody = t.Object({
  targetUserId: t.String({
    minLength: 1,
    description: "ID of the user who will become the new OWNER",
  }),
  currentPassword: t.String({
    minLength: 1,
    description: "OWNER's current password — re-auth guard",
  }),
});

export const AdminUserQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  role: t.Optional(
    t.Union([t.Literal("CUSTOMER"), t.Literal("ADMIN"), t.Literal("OWNER")], {
      description: "Filter by role",
    })
  ),
  includeDeleted: t.Optional(
    t.BooleanString({ description: "Include soft-deleted users (OWNER only)" })
  ),
});

export const UpdateUserRoleBody = t.Object({
  role: t.Union([t.Literal("CUSTOMER"), t.Literal("ADMIN")], {
    description:
      "Target role. OWNER cannot be assigned here — use POST /auth/owner/transfer.",
  }),
});

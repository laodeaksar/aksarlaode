/**
 * POST /admin/invite
 *
 * Creates a new staff account (ADMIN or FINANCE) and sends an invitation email
 * containing a 24-hour password-set link. The account is locked until the
 * invitee clicks the link and sets their own password via the reset-password flow.
 *
 * Requires: OWNER role
 */
import { Effect } from "effect";

import { ConflictError } from "@repo/common/errors";
import { env } from "@repo/env/auth";

import { writeAuditLog } from "@/lib/audit-log";
import { enqueueStaffInvite } from "@/lib/email-queue";
import { hashPassword } from "@/lib/password";
import { isAtLeastOwner } from "@/lib/role";
import { hashToken } from "@/lib/token-hash";
import { resetTokenRepository } from "@/repository/reset-token.repository";
import { userRepository } from "@/repository/user.repository";
import type { HandlerCtx, UserRole } from "@/types";

const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1_000;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const inviteUserHandler = async ({
  body,
  headers,
  set,
}: HandlerCtx) => {
  const actorId = headers["x-user-id"];
  const actorRole = headers["x-user-role"] as UserRole | undefined;

  if (!actorId || !actorRole || !isAtLeastOwner(actorRole)) {
    set.status = 403;
    return { error: "Forbidden — OWNER role required", code: "FORBIDDEN" };
  }

  const { email, role, name } = body as {
    email: string;
    role: string;
    name?: string;
  };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    set.status = 422;
    return { error: "Valid email is required", code: "INVALID_EMAIL" };
  }

  const ASSIGNABLE = new Set(["ADMIN", "FINANCE"]);
  const normalizedRole = role?.toUpperCase();
  if (!normalizedRole || !ASSIGNABLE.has(normalizedRole)) {
    set.status = 422;
    return { error: "Role must be ADMIN or FINANCE", code: "INVALID_ROLE" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const displayName = name?.trim() || normalizedEmail.split("@")[0] || normalizedEmail;

  const program = Effect.gen(function* () {
    // ── Random unusable password — account locked until invite accepted ────
    const secret = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const passwordHash = yield* hashPassword(secret);

    const user = yield* userRepository.create({
      email: normalizedEmail,
      name: displayName,
      passwordHash,
      role: normalizedRole as UserRole,
    });

    // ── Reuse password_reset_tokens — 24 h expiry ─────────────────────────
    yield* resetTokenRepository.deleteAllByUserId(user.id);
    const token = generateToken();
    const tokenHash = yield* Effect.tryPromise({
      try: () => hashToken(token),
      catch: (e) => new Error(String(e)),
    });
    yield* resetTokenRepository.create({
      token: tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
    });

    // ── Enqueue invite email (fire-and-forget) ────────────────────────────
    enqueueStaffInvite({
      userId: user.id,
      email: normalizedEmail,
      name: displayName,
      role: normalizedRole,
      inviteLink: `${env.WEB_URL}/reset-password?token=${token}`,
    }).catch((e) =>
      console.error(
        JSON.stringify({
          event: "staff_invite_email_enqueue_error",
          userId: user.id,
          error: String(e),
        })
      )
    );

    return { userId: user.id };
  });

  const exit = await Effect.runPromiseExit(program);

  if (exit._tag === "Failure") {
    const err = (exit.cause as any).error as { _tag?: string };
    if (err._tag === "ConflictError") {
      set.status = 409;
      return { error: "Email is already registered", code: "CONFLICT" };
    }
    console.error(
      JSON.stringify({ event: "invite_user_error", error: String(exit.cause) })
    );
    set.status = 500;
    return { error: "Failed to create invitation" };
  }

  const { userId } = exit.value;

  writeAuditLog({
    event: "ROLE_CHANGE",
    actorId,
    targetId: userId,
    meta: {
      action: "INVITE_CREATED",
      email: normalizedEmail,
      role: normalizedRole,
    },
  });

  set.status = 201;
  return {
    message: `Invitation sent to ${normalizedEmail}`,
    userId,
    email: normalizedEmail,
    role: normalizedRole,
  };
};

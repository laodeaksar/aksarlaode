/**
 * Admin user management handlers.
 *
 * GET    /admin/users            — paginated user list  (minRole: ADMIN)
 * PATCH  /admin/users/:id/role   — role mutation        (minRole: OWNER)
 * DELETE /admin/users/:id        — soft-delete          (minRole: OWNER)
 * PATCH  /admin/users/:id/restore — restore soft-deleted user (minRole: OWNER)
 *
 * passwordHash is stripped from every response — it never leaves this service.
 */
import { Effect } from "effect";

import { writeAuditLog } from "@/lib/audit-log";
import { canManage, isAtLeastAdmin, isAtLeastOwner } from "@/lib/role";
import { sessionRepository } from "@/repository/session.repository";
import { userRepository } from "@/repository/user.repository";
import type { HandlerCtx, UserRole } from "@/types";

// ── Projection ────────────────────────────────────────────────────────────────
// passwordHash is excluded at the DB query layer (SAFE_USER_COLUMNS in
// user.repository.ts) so it is never present in items returned by findAll.
// The type below reflects what the repository actually returns.

type RawUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const shapeUser = (u: RawUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  avatarUrl: u.avatarUrl ?? null,
  phone: u.phone ?? null,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
  deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
});

// ── GET /admin/users ──────────────────────────────────────────────────────────

export const adminListUsersHandler = async ({
  query,
  headers,
  set,
}: HandlerCtx) => {
  const actorRole = headers["x-user-role"] as UserRole | undefined;

  if (!actorRole || !isAtLeastAdmin(actorRole)) {
    set.status = 403;
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" };
  }

  const q = query as {
    page?: string;
    limit?: string;
    role?: string;
    includeDeleted?: boolean;
  };

  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));

  const VALID_ROLES = new Set<UserRole>(["CUSTOMER", "ADMIN", "OWNER"]);
  const roleFilter = q.role?.toUpperCase() as UserRole | undefined;

  if (roleFilter && !VALID_ROLES.has(roleFilter)) {
    set.status = 422;
    return { error: `Invalid role filter: ${q.role}`, code: "INVALID_ROLE" };
  }

  // ?includeDeleted=true is an OWNER-only privilege
  const includeDeleted = q.includeDeleted === true && isAtLeastOwner(actorRole);

  const result = await Effect.runPromiseExit(
    userRepository.findAll({ page, limit, role: roleFilter, includeDeleted })
  );

  if (result._tag === "Failure") {
    set.status = 500;
    return { error: "Failed to fetch users" };
  }

  const { items, total, totalPages, hasNext, hasPrev } = result.value;

  return {
    items: items.map((u) => shapeUser(u as RawUser)),
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };
};

// ── PATCH /admin/users/:id/role ───────────────────────────────────────────────

export const adminUpdateUserRoleHandler = async ({
  params,
  body,
  headers,
  set,
}: HandlerCtx) => {
  const { id: targetId } = params as { id: string };
  const { role: newRole } = body as { role: UserRole };
  const actorId = headers["x-user-id"];
  const actorRole = headers["x-user-role"] as UserRole | undefined;

  if (!actorId || !actorRole || !isAtLeastOwner(actorRole)) {
    set.status = 403;
    return { error: "Forbidden — OWNER role required", code: "FORBIDDEN" };
  }

  if (newRole === "OWNER") {
    set.status = 422;
    return {
      error:
        "OWNER cannot be assigned via this endpoint. Use POST /auth/owner/transfer.",
      code: "USE_TRANSFER_ENDPOINT",
    };
  }

  if (actorId === targetId) {
    set.status = 422;
    return { error: "Cannot change your own role", code: "SELF_ROLE_CHANGE" };
  }

  const program = Effect.gen(function* () {
    const target = yield* userRepository.findById(targetId);
    if (!target) return yield* Effect.fail({ _tag: "NotFoundError" as const });

    if (!canManage(actorRole, target.role as UserRole)) {
      return yield* Effect.fail({ _tag: "ForbiddenError" as const });
    }

    const updated = yield* userRepository.updateRole(targetId, newRole);
    return { target, updated };
  });

  const exit = await Effect.runPromiseExit(program);

  if (exit._tag === "Failure") {
    const err = exit.cause.error as { _tag: string };
    if (err._tag === "NotFoundError") {
      set.status = 404;
      return { error: "User not found", code: "USER_NOT_FOUND" };
    }
    if (err._tag === "ForbiddenError") {
      set.status = 403;
      return {
        error: "Cannot manage a user with equal or higher role",
        code: "FORBIDDEN",
      };
    }
    set.status = 500;
    return { error: "Failed to update user role" };
  }

  const { target, updated } = exit.value;

  writeAuditLog({
    event: "ROLE_CHANGE",
    actorId,
    targetId,
    meta: { previousRole: target.role, newRole },
  });

  return {
    user: shapeUser(updated as RawUser),
    changed: { from: target.role, to: newRole },
  };
};

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────

export const adminDeleteUserHandler = async ({
  params,
  headers,
  set,
}: HandlerCtx) => {
  const { id: targetId } = params as { id: string };
  const actorId = headers["x-user-id"];
  const actorRole = headers["x-user-role"] as UserRole | undefined;

  // ── Gate 1: caller must be OWNER ──────────────────────────────────────────
  if (!actorId || !actorRole || !isAtLeastOwner(actorRole)) {
    set.status = 403;
    return { error: "Forbidden — OWNER role required", code: "FORBIDDEN" };
  }

  // ── Gate 2: cannot delete yourself ────────────────────────────────────────
  if (actorId === targetId) {
    set.status = 422;
    return { error: "Cannot delete your own account", code: "SELF_DELETE" };
  }

  const program = Effect.gen(function* () {
    // ── Gate 3: target must exist and not already be soft-deleted ──────────
    const target = yield* userRepository.findById(targetId);
    if (!target) return yield* Effect.fail({ _tag: "NotFoundError" as const });

    // ── Gate 4: hard block on OWNER deletion ──────────────────────────────
    if (target.role === "OWNER") {
      return yield* Effect.fail({ _tag: "OwnerProtectedError" as const });
    }

    // canManage covers remaining cases (e.g. ADMIN attempting via a future role)
    if (!canManage(actorRole, target.role as UserRole)) {
      return yield* Effect.fail({ _tag: "ForbiddenError" as const });
    }

    // ── Invalidate all sessions so the user is immediately logged out ──────
    yield* sessionRepository.deleteAllByUserId(targetId);

    // ── Soft-delete the user ───────────────────────────────────────────────
    const deleted = yield* userRepository.softDeleteById(targetId);
    return { target, deleted };
  });

  const exit = await Effect.runPromiseExit(program);

  if (exit._tag === "Failure") {
    const err = exit.cause.error as { _tag: string };
    if (err._tag === "NotFoundError") {
      set.status = 404;
      return { error: "User not found", code: "USER_NOT_FOUND" };
    }
    if (err._tag === "OwnerProtectedError") {
      set.status = 403;
      return {
        error: "OWNER accounts cannot be deleted",
        code: "OWNER_PROTECTED",
      };
    }
    if (err._tag === "ForbiddenError") {
      set.status = 403;
      return {
        error: "Cannot delete a user with equal or higher role",
        code: "FORBIDDEN",
      };
    }
    set.status = 500;
    return { error: "Failed to delete user" };
  }

  const { target } = exit.value;

  writeAuditLog({
    event: "ROLE_CHANGE",
    actorId,
    targetId,
    meta: { action: "SOFT_DELETE", deletedRole: target.role },
  });

  set.status = 200;
  return {
    message: `User ${targetId} soft-deleted and all sessions invalidated.`,
    deleted: {
      id: target.id,
      email: target.email,
      role: target.role,
      deletedAt: new Date().toISOString(),
    },
  };
};

// ── PATCH /admin/users/:id/restore ───────────────────────────────────────────

export const adminRestoreUserHandler = async ({
  params,
  headers,
  set,
}: HandlerCtx) => {
  const { id: targetId } = params as { id: string };
  const actorId = headers["x-user-id"];
  const actorRole = headers["x-user-role"] as UserRole | undefined;

  if (!actorId || !actorRole || !isAtLeastOwner(actorRole)) {
    set.status = 403;
    return { error: "Forbidden — OWNER role required", code: "FORBIDDEN" };
  }

  const program = Effect.gen(function* () {
    // Must use the include-deleted variant to find the target
    const target = yield* userRepository.findByIdIncludeDeleted(targetId);
    if (!target) return yield* Effect.fail({ _tag: "NotFoundError" as const });
    if (!target.deletedAt)
      return yield* Effect.fail({ _tag: "NotDeletedError" as const });

    const restored = yield* userRepository.restoreById(targetId);
    return { target, restored };
  });

  const exit = await Effect.runPromiseExit(program);

  if (exit._tag === "Failure") {
    const err = exit.cause.error as { _tag: string };
    if (err._tag === "NotFoundError") {
      set.status = 404;
      return { error: "User not found", code: "USER_NOT_FOUND" };
    }
    if (err._tag === "NotDeletedError") {
      set.status = 409;
      return { error: "User is not soft-deleted", code: "NOT_DELETED" };
    }
    set.status = 500;
    return { error: "Failed to restore user" };
  }

  const { restored } = exit.value;

  writeAuditLog({
    event: "ROLE_CHANGE",
    actorId,
    targetId,
    meta: { action: "RESTORE", restoredRole: restored!.role },
  });

  set.status = 200;
  return {
    message: `User ${targetId} restored successfully.`,
    user: shapeUser(restored as RawUser),
  };
};

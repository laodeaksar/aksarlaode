/**
 * Admin user management handlers.
 *
 * GET  /admin/users            — paginated user list (minRole: ADMIN)
 * PATCH /admin/users/:id/role  — role mutation    (minRole: OWNER)
 *
 * passwordHash is stripped from every response — it never leaves this service.
 */
import { Effect }          from "effect"
import type { HandlerCtx } from "@/types"
import type { UserRole }   from "@/types"
import { userRepository }  from "@/repository/user.repository"
import { canManage, isAtLeastAdmin, isAtLeastOwner } from "@/lib/role"
import { writeAuditLog }   from "@/lib/audit-log"

// ── Projection — passwordHash must never appear in API responses ──────────────

type RawUser = {
  id:           string
  email:        string
  name:         string
  role:         string
  avatarUrl:    string | null
  phone:        string | null
  createdAt:    Date
  updatedAt:    Date
  passwordHash: string   // present in DB row, stripped here
}

const shapeUser = (u: RawUser) => ({
  id:        u.id,
  email:     u.email,
  name:      u.name,
  role:      u.role,
  avatarUrl: u.avatarUrl ?? null,
  phone:     u.phone     ?? null,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
})

// ── GET /admin/users ─────────────────────────────────────────────────────────

export const adminListUsersHandler = async ({ query, headers, set }: HandlerCtx) => {
  const actorRole = headers["x-user-role"] as UserRole | undefined

  if (!actorRole || !isAtLeastAdmin(actorRole)) {
    set.status = 403
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" }
  }

  const q = query as { page?: string; limit?: string; role?: string }

  const page  = Math.max(1, Number(q.page  ?? 1))
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)))

  // Validate optional role filter
  const VALID_ROLES = new Set<UserRole>(["CUSTOMER", "ADMIN", "OWNER"])
  const roleFilter  = q.role?.toUpperCase() as UserRole | undefined

  if (roleFilter && !VALID_ROLES.has(roleFilter)) {
    set.status = 422
    return { error: `Invalid role filter: ${q.role}`, code: "INVALID_ROLE" }
  }

  const result = await Effect.runPromiseExit(
    userRepository.findAll({ page, limit, role: roleFilter })
  )

  if (result._tag === "Failure") {
    set.status = 500
    return { error: "Failed to fetch users" }
  }

  const { items, total, totalPages, hasNext, hasPrev } = result.value

  return {
    items: items.map(u => shapeUser(u as RawUser)),
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  }
}

// ── PATCH /admin/users/:id/role ───────────────────────────────────────────────

export const adminUpdateUserRoleHandler = async ({ params, body, headers, set }: HandlerCtx) => {
  const { id: targetId }  = params  as { id: string }
  const { role: newRole } = body    as { role: UserRole }
  const actorId           = headers["x-user-id"]
  const actorRole         = headers["x-user-role"] as UserRole | undefined

  // ── Gate 1: caller must be OWNER ──────────────────────────────────────────
  if (!actorId || !actorRole || !isAtLeastOwner(actorRole)) {
    set.status = 403
    return { error: "Forbidden — OWNER role required", code: "FORBIDDEN" }
  }

  // ── Gate 2: OWNER cannot be assigned via this endpoint ───────────────────
  // Use POST /auth/owner/transfer for ownership transfers.
  if (newRole === "OWNER") {
    set.status = 422
    return {
      error: "OWNER cannot be assigned via this endpoint. Use POST /auth/owner/transfer.",
      code:  "USE_TRANSFER_ENDPOINT",
    }
  }

  // ── Gate 3: cannot mutate own role ───────────────────────────────────────
  if (actorId === targetId) {
    set.status = 422
    return { error: "Cannot change your own role", code: "SELF_ROLE_CHANGE" }
  }

  const program = Effect.gen(function* () {
    // ── Gate 4: target must exist ──────────────────────────────────────────
    const target = yield* userRepository.findById(targetId)
    if (!target) return yield* Effect.fail({ _tag: "NotFoundError" as const })

    // ── Gate 5: row-level canManage check ─────────────────────────────────
    // Prevents OWNER from managing another OWNER (shouldn't happen since
    // newRole === "OWNER" is blocked above, but this also protects against
    // demoting an existing OWNER to ADMIN or CUSTOMER via this endpoint).
    if (!canManage(actorRole, target.role as UserRole)) {
      return yield* Effect.fail({ _tag: "ForbiddenError" as const })
    }

    const updated = yield* userRepository.updateRole(targetId, newRole)
    return { target, updated }
  })

  const exit = await Effect.runPromiseExit(program)

  if (exit._tag === "Failure") {
    const err = exit.cause.error as { _tag: string }
    if (err._tag === "NotFoundError") {
      set.status = 404
      return { error: "User not found", code: "USER_NOT_FOUND" }
    }
    if (err._tag === "ForbiddenError") {
      set.status = 403
      return { error: "Cannot manage a user with equal or higher role", code: "FORBIDDEN" }
    }
    set.status = 500
    return { error: "Failed to update user role" }
  }

  const { target, updated } = exit.value

  writeAuditLog({
    event:    "ROLE_CHANGE",
    actorId,
    targetId,
    meta: { previousRole: target.role, newRole },
  })

  return {
    user:    shapeUser(updated as RawUser),
    changed: { from: target.role, to: newRole },
  }
}

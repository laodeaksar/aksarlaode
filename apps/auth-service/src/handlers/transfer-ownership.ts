/**
 * POST /auth/owner/transfer
 *
 * Transfers the OWNER role from the current owner to another user.
 * The acting user is downgraded to ADMIN atomically in the same
 * DB transaction — there is never a moment with zero or two OWNERs.
 *
 * Security gates:
 *  1. Caller must carry x-user-role: OWNER (enforced by gateway route guard)
 *  2. Password re-verification (re-auth guard — mitigates stolen session attacks)
 *  3. Cannot transfer to self
 *  4. Target must be a real, existing user
 *
 * After a successful transfer the caller's active JWT still claims
 * OWNER. They must re-login (or wait for token expiry) for the new
 * role to be reflected. The response body communicates this clearly.
 */
import { Effect }              from "effect"
import { verifyPassword }      from "@/lib/password"
import { userRepository }      from "@/repository/user.repository"
import { writeAuditLog }       from "@/lib/audit-log"
import { isAtLeastOwner }      from "@/lib/role"
import type { HandlerCtx }     from "@/types"
import type { UserRole }       from "@/types"

type TransferOwnershipBody = {
  targetUserId:    string
  currentPassword: string
}

export const transferOwnershipHandler = async ({ body, headers, set }: HandlerCtx) => {
  const { targetUserId, currentPassword } = body as TransferOwnershipBody
  const actorId   = headers["x-user-id"]
  const actorRole = headers["x-user-role"] as UserRole | undefined

  // ── Gate 1: caller must be OWNER ────────────────────────────────────────
  // The gateway route guard already enforces this via ROLE_HIERARCHY, but we
  // double-check here so the handler is safe if called directly in tests or
  // if the gateway config ever drifts.
  if (!actorId || !actorRole || !isAtLeastOwner(actorRole)) {
    set.status = 403
    return { error: "Only the OWNER can transfer ownership", code: "FORBIDDEN" }
  }

  // ── Gate 2: cannot transfer to self ─────────────────────────────────────
  if (actorId === targetUserId) {
    set.status = 422
    return { error: "Cannot transfer ownership to yourself", code: "INVALID_TARGET" }
  }

  const program = Effect.gen(function* () {
    // ── Gate 3: re-authenticate the OWNER ─────────────────────────────────
    const actor = yield* userRepository.findById(actorId)
    if (!actor) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    const passwordOk = yield* verifyPassword(currentPassword, actor.passwordHash)
    if (!passwordOk) {
      return yield* Effect.fail({ _tag: "AuthError" as const })
    }

    // ── Gate 4: target user must exist ────────────────────────────────────
    const target = yield* userRepository.findById(targetUserId)
    if (!target) {
      return yield* Effect.fail({ _tag: "NotFoundError" as const })
    }

    // ── Atomic role swap ──────────────────────────────────────────────────
    // transferOwnership runs both updates inside a single DB transaction.
    const result = yield* userRepository.transferOwnership(actorId, targetUserId)
    return result
  })

  const exit = await Effect.runPromiseExit(program)

  if (exit._tag === "Failure") {
    const err = exit.cause.error as { _tag: string }

    if (err._tag === "AuthError") {
      set.status = 401
      return { error: "Password verification failed", code: "INVALID_CREDENTIALS" }
    }
    if (err._tag === "NotFoundError") {
      set.status = 404
      return { error: "Target user not found", code: "USER_NOT_FOUND" }
    }
    set.status = 500
    return { error: "Failed to transfer ownership" }
  }

  // ── Audit log ─────────────────────────────────────────────────────────
  writeAuditLog({
    event:    "OWNER_TRANSFER",
    actorId,
    targetId: targetUserId,
    meta:     { previousRole: "OWNER", newRole: "ADMIN" },
  })

  return {
    message: "Ownership transferred successfully. Re-login to receive an updated token.",
    newOwner: {
      id:   exit.value.newOwner.id,
      role: exit.value.newOwner.role,
    },
    prevOwner: {
      id:   exit.value.prevOwner.id,
      role: exit.value.prevOwner.role,
    },
  }
}

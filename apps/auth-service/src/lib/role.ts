/**
 * Role hierarchy utilities — single source of truth for RBAC logic
 * inside auth-service.
 *
 * Hierarchy (ascending privilege):
 *   CUSTOMER (0) < ADMIN (1) < OWNER (2)
 *
 * SERVICE is an internal gateway concept and is not a persistent
 * user role — it is not represented here.
 */
import type { UserRole } from "@/types"

export const ROLE_LEVEL: Record<UserRole, number> = {
  CUSTOMER: 0,
  ADMIN:    1,
  OWNER:    2,
} as const

/**
 * Returns true when `userRole` meets or exceeds `minRole`.
 * Use this instead of direct `===` comparisons to respect the hierarchy.
 */
export const hasMinRole = (userRole: UserRole, minRole: UserRole): boolean =>
  ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole]

/** Convenience predicates */
export const isOwner    = (role: UserRole): boolean => role === "OWNER"
export const isAtLeastAdmin  = (role: UserRole): boolean => hasMinRole(role, "ADMIN")
export const isAtLeastOwner  = (role: UserRole): boolean => hasMinRole(role, "OWNER")

/**
 * Returns true when `actorRole` is allowed to manage `targetRole`.
 *
 * Rules:
 *  - OWNER can manage ADMIN and CUSTOMER
 *  - ADMIN can manage CUSTOMER only
 *  - Nobody can manage another OWNER (prevents privilege escalation)
 */
export const canManage = (actorRole: UserRole, targetRole: UserRole): boolean => {
  if (targetRole === "OWNER") return false          // OWNER is unmanageable by anyone
  return ROLE_LEVEL[actorRole] > ROLE_LEVEL[targetRole]
}

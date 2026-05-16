// FIX ADM-05: Granular RBAC with ADMIN, OWNER, and FINANCE roles.
//
// Role hierarchy (most privileged first):
//   OWNER   — full access including user management and billing
//   ADMIN   — full product and order management
//   FINANCE — read-only access to orders and revenue; no product management
//
// Usage:
//   import { can } from "@/lib/rbac"
//   if (!can(session.role, "products:write")) return <Forbidden />

import type { UserRole } from "@/lib/auth"

export type Permission =
  | "products:read"
  | "products:write"
  | "orders:read"
  | "orders:write"
  | "customers:read"
  | "dashboard:read"
  | "users:manage"

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    "products:read",
    "products:write",
    "orders:read",
    "orders:write",
    "customers:read",
    "dashboard:read",
    "users:manage",
  ],
  ADMIN: [
    "products:read",
    "products:write",
    "orders:read",
    "orders:write",
    "customers:read",
    "dashboard:read",
  ],
  FINANCE: [
    "orders:read",
    "customers:read",
    "dashboard:read",
  ],
  CUSTOMER: [],
}

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER" || role === "FINANCE"
}

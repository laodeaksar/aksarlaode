// src/lib/index.ts — barrel export
//
// Import utility and types from here:
//   import { silentRefresh, getSessionFn, can, useSession } from "@/lib"
//   import type { Session, UserRole, Permission } from "@/lib"
//
// Rule: files INSIDE src/lib/* that import from siblings use the direct path
// (e.g. "@/lib/auth") to avoid circular deps.
// This barrel is only for EXTERNAL consumers (routes, components, etc).

// api
export { silentRefresh } from "./api";
export type {
  AuditLogEntry,
  DashboardStats,
  OrderSummary,
  OrderDetail,
} from "./api";

// toast
export { toast } from "./toast";

// auth
// getSession: browser-only (deprecated) — use getSessionFn from @/server/auth
export { getSession } from "./auth";
export type { Session, UserRole } from "./auth";

// server/auth re-exports
// getSessionFn works on server (SSR) and client via createServerFn.
// Re-exported from here so consumers don't need to know the server/* path
export { getSessionFn } from "../server/auth";

// effect-resolver
export { effectResolver } from "./effect-resolver";

// rbac
export { can, hasAnyAdminRole } from "./rbac";
export type { Permission } from "./rbac";

// router-context
export type { RouterContext } from "./router-context";

// session-context
export { SessionContext, useSession } from "./session-context";

// utils
export { formatIDR } from "./utils";

// use-filtered-navigation
export { useFilteredNavigation } from "./use-filtered-navigation";

// use-debounced-input
export { useDebouncedInput } from "./use-debounced-input";

// use-new-orders
export { useNewOrdersCount } from "./use-new-orders";

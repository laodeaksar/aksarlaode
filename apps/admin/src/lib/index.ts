// ── src/lib/index.ts — barrel export ──────────────────────────────────────
//
// Importa utility e tipi interni sempre da qui:
//   import { silentRefresh, getSession, can, useSession } from "@/lib"
//   import type { Session, UserRole, Permission } from "@/lib"
//
// Regola: i file DENTRO src/lib/* che importano da fratelli usano il percorso
// diretto (e.g. "@/lib/auth") per evitare circular deps.
// Questo barrel è solo per i CONSUMER esterni (route, componenti, ecc).

// ── api ────────────────────────────────────────────────────────────────────
export { silentRefresh } from "./api";
export type {
  AuditLogEntry,
  DashboardStats,
  OrderSummary,
  OrderDetail,
} from "./api";

// ── toast ──────────────────────────────────────────────────────────────────
export { toast } from "./toast";

// ── auth ───────────────────────────────────────────────────────────────────
export { getSession } from "./auth";
export type { Session, UserRole } from "./auth";

// ── effect-resolver ────────────────────────────────────────────────────────
export { effectResolver } from "./effect-resolver";

// ── rbac ───────────────────────────────────────────────────────────────────
export { can, hasAnyAdminRole } from "./rbac";
export type { Permission } from "./rbac";

// ── router-context ─────────────────────────────────────────────────────────
export type { RouterContext } from "./router-context";

// ── session-context ────────────────────────────────────────────────────────
export { SessionContext, useSession } from "./session-context";

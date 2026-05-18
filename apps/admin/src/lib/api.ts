// ── lib/api.ts — LAYER-01 cleanup ─────────────────────────────────────────
//
// Scope post-LAYER-01: solo silentRefresh interceptor.
//
// Aturan definitif (dari admin-consistency.md):
//   login / logout       → src/server/auth.ts (server function + cookie forwarding)
//   silent token refresh → sini (butuh window.location + client-side cookie)
//   semua data lainnya   → src/server/*.ts (Effect server function)
//
// TYPE-04 selesai: 4 response types dipindah ke src/types/api-responses.ts.

import { env } from "@repo/env/admin"

// FIX ADM-02: token refresh state — one in-flight refresh at a time.
// If multiple requests 401 simultaneously, only one refresh call is made;
// the others wait for the same promise.
let refreshPromise: Promise<boolean> | null = null

export async function silentRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${env.PUBLIC_API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      return res.ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// ── Response types ─────────────────────────────────────────────────────────
// TYPE-04 selesai: definisi dipindahkan ke src/types/api-responses.ts.
// Re-ekspor di sini untuk backward compat — konsumen lama yang import dari
// "@/lib" atau "@/lib/api" masih berfungsi tanpa perubahan.
export type {
  AuditLogEntry,
  DashboardStats,
  OrderDetail,
  OrderSummary,
} from "@/types"

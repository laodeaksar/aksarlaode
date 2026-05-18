// ── lib/api.ts — LAYER-02 cleanup ─────────────────────────────────────────
//
// Scope post-LAYER-02: SOLO auth (login / logout / silent-refresh).
// Tutte le altre API sono migrate a server functions in src/server/*.ts che
// usano ApiClientService (Effect layer) con service-to-service token.
//
// Regola definitiva (da admin-consistency.md):
//   login / logout / refresh  → qui (window.location + cookie handling)
//   semua data lainnya        → src/server/*.ts (Effect server function)
//
// TYPE-04 selesai: 4 response types dipindah ke src/types/api-responses.ts.

import { env } from "@repo/env/admin"

type ApiResponse<T> = { data: T; error: null } | { data: null; error: string }

// FIX ADM-02: token refresh state — one in-flight refresh at a time.
// If multiple requests 401 simultaneously, only one refresh call is made;
// the others wait for the same promise.
let refreshPromise: Promise<boolean> | null = null

async function silentRefresh(): Promise<boolean> {
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

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${env.PUBLIC_API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    // FIX ADM-02: intercept TOKEN_EXPIRED 401 — attempt a silent refresh once.
    // If the refresh succeeds, retry the original request automatically.
    // If the refresh fails (e.g. refresh token also expired), redirect to login.
    if (res.status === 401 && !isRetry) {
      let errorCode = ""
      try {
        const body = await res.clone().json()
        errorCode = body?.code ?? ""
      } catch {
        /* ignore parse errors */
      }

      if (errorCode === "TOKEN_EXPIRED" || errorCode === "UNAUTHORIZED") {
        const refreshed = await silentRefresh()

        if (refreshed) {
          return request<T>(path, options, true)
        }

        window.location.href = "/login"
        return { data: null, error: "Session expired" }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      return { data: null, error: err.error ?? "Request failed" }
    }

    const data = (await res.json()) as T
    return { data, error: null }
  } catch (e) {
    return { data: null, error: String(e) }
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────
// login + logout pakai client-side fetch karena butuh cookie credentials dan
// window.location redirect — tidak bisa dijalankan di server function.
export const authApi = {
  login: (body: { email: string; password: string }) =>
    request<{
      accessToken: string
      user: { id: string; email: string; name: string; role: string }
    }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),
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

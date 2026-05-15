// ── Public routes (no JWT required) ──────────────────────────────────────────
// Method "*" means any HTTP method is public for that path.
export const PUBLIC_ROUTES: ReadonlyArray<{ path: string; method: string }> = [
  // Health check
  { path: "/health",                  method: "*"    },

  // Auth — unauthenticated flows
  { path: "/auth/login",              method: "POST" },
  { path: "/auth/register",           method: "POST" },
  { path: "/auth/refresh",            method: "POST" },
  { path: "/auth/forgot-password",    method: "POST" },
  { path: "/auth/reset-password",     method: "POST" },

  // Product catalogue — read-only public
  { path: "/products",                method: "GET"  },
  { path: "/products/:id",            method: "GET"  },
  { path: "/products/slug/:slug",     method: "GET"  },
]

// ── Webhook routes (HMAC-verified, no JWT) ────────────────────────────────────
export const WEBHOOK_ROUTES: ReadonlyArray<string> = ["/webhooks"]

// ── Role hierarchy (higher number = more privileged) ─────────────────────────
//
// OWNER sits above ADMIN for human users.
// SERVICE is a gateway-internal synthetic role for inter-service calls;
// it is not stored in the DB and not issued in user JWTs.
export const ROLE_HIERARCHY = {
  CUSTOMER: 0,
  ADMIN:    1,
  OWNER:    2,
  SERVICE:  3,
} as const

// ── RBAC rules — first matching rule wins ─────────────────────────────────────
// pattern: regex tested against c.req.path
// method:  HTTP verb or "*" for any
// minRole: minimum role required
export const ROUTE_PERMISSIONS: ReadonlyArray<{
  pattern: RegExp
  method:  string
  minRole: keyof typeof ROLE_HIERARCHY
}> = [
  // ── Owner-exclusive routes ────────────────────────────────────────────────
  // Transfer ownership — only the current OWNER can initiate
  { pattern: /^\/auth\/owner\//,              method: "*",      minRole: "OWNER"    },
  // Role mutation — must precede the /admin catch-all
  { pattern: /^\/admin\/users\/.+\/role$/,    method: "PATCH",  minRole: "OWNER"    },
  // Hard-delete user (cascade-invalidates sessions) — must precede /admin catch-all
  { pattern: /^\/admin\/users\/.+$/,          method: "DELETE", minRole: "OWNER"    },

  // ── Admin panel ───────────────────────────────────────────────────────────
  { pattern: /^\/admin/,                      method: "*",      minRole: "ADMIN"    },

  // ── Products — writes are admin-only, reads are public (handled above) ────
  { pattern: /^\/products/,             method: "POST",   minRole: "ADMIN"    },
  { pattern: /^\/products\/.+/,         method: "PUT",    minRole: "ADMIN"    },
  { pattern: /^\/products\/.+/,         method: "PATCH",  minRole: "ADMIN"    },
  { pattern: /^\/products\/.+/,         method: "DELETE", minRole: "ADMIN"    },

  // ── Orders ────────────────────────────────────────────────────────────────
  // Customers can create and view their own; ownerOrAdmin middleware handles row-level
  { pattern: /^\/orders$/,              method: "POST",   minRole: "CUSTOMER" },
  { pattern: /^\/orders\/.+/,           method: "GET",    minRole: "CUSTOMER" },
  { pattern: /^\/orders\/.+\/cancel/,   method: "POST",   minRole: "CUSTOMER" },
  { pattern: /^\/orders$/,              method: "GET",    minRole: "ADMIN"    },
  { pattern: /^\/orders\/.+\/status/,   method: "PATCH",  minRole: "ADMIN"    },

  // ── Payments ──────────────────────────────────────────────────────────────
  { pattern: /^\/payments/,             method: "*",      minRole: "CUSTOMER" },

  // ── Auth — session management requires login ──────────────────────────────
  { pattern: /^\/auth\/sessions/,       method: "*",      minRole: "CUSTOMER" },
  { pattern: /^\/auth\/me/,             method: "*",      minRole: "CUSTOMER" },
  { pattern: /^\/auth\/logout/,         method: "POST",   minRole: "CUSTOMER" },
  { pattern: /^\/auth\/change-password/, method: "POST",  minRole: "CUSTOMER" },
]

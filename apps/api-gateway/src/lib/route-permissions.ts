// ── Public routes (no auth required) ─────────────────────
export const PUBLIC_ROUTES = [
  { path: "/auth/login",          method: "POST" },
  { path: "/auth/register",       method: "POST" },
  { path: "/auth/refresh",        method: "POST" },
  { path: "/products",            method: "GET"  },
  { path: "/products/:id",        method: "GET"  },
  { path: "/health",              method: "GET"  },
] as const

// ── Webhook routes (HMAC only, no JWT) ───────────────────
export const WEBHOOK_ROUTES = ["/webhooks"] as const

// ── RBAC: route prefix → minimum role ─────────────────────
export const ROLE_HIERARCHY = {
  CUSTOMER: 0,
  ADMIN:    1,
  SERVICE:  2,
} as const

export const ROUTE_PERMISSIONS: Array<{
  pattern: RegExp
  method:  string
  minRole: keyof typeof ROLE_HIERARCHY
}> = [
  { pattern: /^\\/admin/,            method: "*",    minRole: "ADMIN"    },
  { pattern: /^\\/orders/,           method: "POST", minRole: "CUSTOMER" },
  { pattern: /^\\/orders\\/.+/,       method: "GET",  minRole: "CUSTOMER" },
  { pattern: /^\\/orders/,           method: "GET",  minRole: "ADMIN"    }, // list all
  { pattern: /^\\/products/,         method: "POST", minRole: "ADMIN"    },
  { pattern: /^\\/products\\/.+/,     method: "PUT",  minRole: "ADMIN"    },
  { pattern: /^\\/products\\/.+/,     method: "DELETE", minRole: "ADMIN"  },
  { pattern: /^\\/payments/,         method: "*",    minRole: "CUSTOMER" },
]

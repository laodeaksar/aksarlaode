// ── Public routes (no JWT required) ──────────────────────────────────────────
// Method "*" means any HTTP method is public for that path.
// C-09: Each public route is registered for both /v1 (canonical) and / (legacy).
export const PUBLIC_ROUTES: ReadonlyArray<{ path: string; method: string }> = [
  // Health check
  { path: "/health", method: "*" },

  // Auth — unauthenticated flows
  { path: "/auth/login", method: "POST" },
  { path: "/auth/register", method: "POST" },
  { path: "/auth/refresh", method: "POST" },
  { path: "/auth/forgot-password", method: "POST" },
  { path: "/auth/reset-password", method: "POST" },

  // Auth — unauthenticated flows (v1)
  { path: "/v1/auth/login", method: "POST" },
  { path: "/v1/auth/register", method: "POST" },
  { path: "/v1/auth/refresh", method: "POST" },
  { path: "/v1/auth/forgot-password", method: "POST" },
  { path: "/v1/auth/reset-password", method: "POST" },

  // Product catalogue — read-only public
  { path: "/products", method: "GET" },
  { path: "/products/:id", method: "GET" },
  { path: "/products/:id/stock", method: "GET" }, // C-02: stock check — dipakai order-service & storefront
  { path: "/products/slug/:slug", method: "GET" },

  // Product catalogue — read-only public (v1)
  { path: "/v1/products", method: "GET" },
  { path: "/v1/products/:id", method: "GET" },
  { path: "/v1/products/:id/stock", method: "GET" },
  { path: "/v1/products/slug/:slug", method: "GET" },
];

// ── Webhook routes (HMAC-verified, no JWT) ────────────────────────────────────
// C-09: Both versioned and legacy webhook paths are HMAC-verified.
export const WEBHOOK_ROUTES: ReadonlyArray<string> = [
  "/webhooks",
  "/v1/webhooks",
];

// ── Role hierarchy (higher number = more privileged) ─────────────────────────
//
// OWNER sits above ADMIN for human users.
// SERVICE is a gateway-internal synthetic role for inter-service calls;
// it is not stored in the DB and not issued in user JWTs.
export const ROLE_HIERARCHY = {
  CUSTOMER: 0,
  ADMIN: 1,
  OWNER: 2,
  SERVICE: 3,
} as const;

// ── RBAC rules — first matching rule wins ─────────────────────────────────────
// pattern: regex tested against c.req.path
// method:  HTTP verb or "*" for any
// minRole: minimum role required
//
// C-09: All patterns use (?:\/v1)? so they match both /v1/... (canonical) and
// /... (legacy) without duplicating rules. Remove the optional group once the
// legacy unversioned mounts are retired.
//
// C-08: PUT /products/:id rule removed — PATCH is the single update verb.
export const ROUTE_PERMISSIONS: ReadonlyArray<{
  pattern: RegExp;
  method: string;
  minRole: keyof typeof ROLE_HIERARCHY;
}> = [
  // ── Owner-exclusive routes ────────────────────────────────────────────────
  // Global store settings write — only the OWNER can change runtime config.
  // Must precede the general /admin catch-all so this more-specific rule wins.
  {
    pattern: /^(?:\/v1)?\/admin\/settings$/,
    method: "PUT",
    minRole: "OWNER",
  },
  // Transfer ownership — only the current OWNER can initiate
  { pattern: /^(?:\/v1)?\/auth\/owner\//, method: "*", minRole: "OWNER" },
  // Role mutation — must precede the /admin catch-all
  {
    pattern: /^(?:\/v1)?\/admin\/users\/.+\/role$/,
    method: "PATCH",
    minRole: "OWNER",
  },
  // Hard-delete user (cascade-invalidates sessions) — must precede /admin catch-all
  {
    pattern: /^(?:\/v1)?\/admin\/users\/.+$/,
    method: "DELETE",
    minRole: "OWNER",
  },

  // ── Admin panel ───────────────────────────────────────────────────────────
  { pattern: /^(?:\/v1)?\/admin/, method: "*", minRole: "ADMIN" },

  // ── Products — writes are admin-only, reads are public (handled above) ────
  { pattern: /^(?:\/v1)?\/products/, method: "POST", minRole: "ADMIN" },
  { pattern: /^(?:\/v1)?\/products\/.+/, method: "PATCH", minRole: "ADMIN" },
  { pattern: /^(?:\/v1)?\/products\/.+/, method: "DELETE", minRole: "ADMIN" },

  // ── Orders ────────────────────────────────────────────────────────────────
  // Customers can create and view their own; ownerOrAdmin middleware handles row-level
  { pattern: /^(?:\/v1)?\/orders$/, method: "POST", minRole: "CUSTOMER" },
  { pattern: /^(?:\/v1)?\/orders\/.+/, method: "GET", minRole: "CUSTOMER" },
  {
    pattern: /^(?:\/v1)?\/orders\/.+\/cancel/,
    method: "POST",
    minRole: "CUSTOMER",
  },
  { pattern: /^(?:\/v1)?\/orders$/, method: "GET", minRole: "ADMIN" },
  {
    pattern: /^(?:\/v1)?\/orders\/.+\/status/,
    method: "PATCH",
    minRole: "ADMIN",
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  { pattern: /^(?:\/v1)?\/payments/, method: "*", minRole: "CUSTOMER" },

  // ── Auth — session management requires login ──────────────────────────────
  { pattern: /^(?:\/v1)?\/auth\/sessions/, method: "*", minRole: "CUSTOMER" },
  { pattern: /^(?:\/v1)?\/auth\/me/, method: "*", minRole: "CUSTOMER" },
  { pattern: /^(?:\/v1)?\/auth\/logout/, method: "POST", minRole: "CUSTOMER" },
  {
    pattern: /^(?:\/v1)?\/auth\/change-password/,
    method: "POST",
    minRole: "CUSTOMER",
  },
];

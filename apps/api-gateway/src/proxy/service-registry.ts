import { env } from "@repo/env/gateway"

// ── Service registry ──────────────────────────────────────────────────────────
// Each entry maps:
//   url       — the internal base URL of the downstream service
//   prefix    — the path prefix used in the gateway, which is stripped before proxying
//   timeoutMs — per-service request timeout; longer for services that call
//               external APIs (payment gateway), shorter for internal-only services.
//
// FIX GW-06: Timeout configuration lives here as the single source of truth.
// request-timeout middleware reads this map so timeouts and routing stay in sync.
//
// Example:  GET /products/123 → http://product-service:3002/123
export const SERVICE_REGISTRY = {
  AUTH: { url: env.AUTH_SERVICE_URL, prefix: "/auth", timeoutMs: 10_000 },
  PRODUCT: {
    url: env.PRODUCT_SERVICE_URL,
    prefix: "/products",
    timeoutMs: 15_000,
  },
  ORDER: { url: env.ORDER_SERVICE_URL, prefix: "/orders", timeoutMs: 20_000 },
  PAYMENT: {
    url: env.PAYMENT_SERVICE_URL,
    prefix: "/payments",
    timeoutMs: 30_000,
  },
} as const

// Webhooks are not a proxied service but share the payment timeout budget.
export const WEBHOOK_TIMEOUT_MS = 30_000
export const DEFAULT_TIMEOUT_MS = 15_000

export type ServiceName = keyof typeof SERVICE_REGISTRY

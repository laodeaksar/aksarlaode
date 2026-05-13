import { env } from "@repo/env/gateway"

// ── Service registry ──────────────────────────────────────────────────────────
// Each entry maps:
//   url    — the internal base URL of the downstream service
//   prefix — the path prefix used in the gateway, which is stripped before proxying
//
// Example:  GET /products/123 → http://product-service:3002/123
export const SERVICE_REGISTRY = {
  AUTH:    { url: env.AUTH_SERVICE_URL,    prefix: "/auth"      },
  PRODUCT: { url: env.PRODUCT_SERVICE_URL, prefix: "/products"  },
  ORDER:   { url: env.ORDER_SERVICE_URL,   prefix: "/orders"    },
  PAYMENT: { url: env.PAYMENT_SERVICE_URL, prefix: "/payments"  },
} as const

export type ServiceName = keyof typeof SERVICE_REGISTRY

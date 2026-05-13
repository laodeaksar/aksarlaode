import { env } from "@repo/env"

export const SERVICE_REGISTRY = {
  AUTH:    env.AUTH_SERVICE_URL,       // <http://auth-service:3001>
  PRODUCT: env.PRODUCT_SERVICE_URL,    // <http://product-service:3002>
  ORDER:   env.ORDER_SERVICE_URL,      // <http://order-service:3003>
  PAYMENT: env.PAYMENT_SERVICE_URL,    // <http://payment-service:3004>
} as const

export type ServiceName = keyof typeof SERVICE_REGISTRY

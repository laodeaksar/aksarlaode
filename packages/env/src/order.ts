import { z } from "zod/v4"

import { parseEnv } from "./utils"

/**
 * Environment variables required by order-service.
 * Import as: import { env } from "@repo/env/order"
 */
export const env = parseEnv(
  {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),

    REDIS_HOST: z.string().min(1, "REDIS_HOST is required"),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().default(""),

    INTERNAL_SERVICE_TOKEN: z
      .string()
      .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),

    PRODUCT_SERVICE_URL: z.url("PRODUCT_SERVICE_URL must be a valid URL"),

    MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY is required"),

    MINIMUM_ORDER_AMOUNT: z.coerce.number().nonnegative().default(1000),

    // How long (minutes) a PENDING_PAYMENT order is valid before it expires
    PAYMENT_EXPIRY_MINUTES: z.coerce.number().int().positive().default(60),

    // How often (milliseconds) the reconciliation sweep runs
    RECONCILIATION_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(300_000), // 5 min

    // Sliding-window rate limit for POST /orders (per userId)
    RATE_LIMIT_ORDER_CREATE_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_ORDER_CREATE_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000), // 1 min

    // Sliding-window rate limit for POST /webhooks/payment (per source IP)
    RATE_LIMIT_WEBHOOK_MAX: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_WEBHOOK_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000), // 1 min

    WEB_URL: z.url("WEB_URL must be a valid URL"),
    ADMIN_URL: z.url("ADMIN_URL must be a valid URL"),
  },
  "order-service"
)

export type OrderEnv = typeof env

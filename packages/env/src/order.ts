import { z }        from "zod/v4"
import { parseEnv } from "./utils"

/**
 * Environment variables required by order-service.
 * Import as: import { env } from "@repo/env/order"
 */
export const env = parseEnv(
  {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),

    REDIS_HOST:     z.string().min(1, "REDIS_HOST is required"),
    REDIS_PORT:     z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().default(""),

    INTERNAL_SERVICE_TOKEN: z.string().min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),

    PRODUCT_SERVICE_URL: z.url("PRODUCT_SERVICE_URL must be a valid URL"),

    WEB_URL:   z.url("WEB_URL must be a valid URL"),
    ADMIN_URL: z.url("ADMIN_URL must be a valid URL"),
  },
  "order-service"
)

export type OrderEnv = typeof env

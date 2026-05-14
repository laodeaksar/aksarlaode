import { z }        from "zod/v4"
import { parseEnv } from "./utils"

/**
 * Environment variables required by product-service.
 * Import as: import { env } from "@repo/env/product"
 */
export const env = parseEnv(
  {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    INTERNAL_SERVICE_TOKEN: z.string().min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),

    WEB_URL:   z.url("WEB_URL must be a valid URL"),
    ADMIN_URL: z.url("ADMIN_URL must be a valid URL"),
  },
  "product-service"
)

export type ProductEnv = typeof env

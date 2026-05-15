import { z }        from "zod/v4"
import { parseEnv } from "./utils"

/**
 * Environment variables required by auth-service.
 * Import as: import { env } from "@repo/env/auth"
 */
export const env = parseEnv(
  {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // PostgreSQL — accepts any connection string scheme (postgres://, postgresql://)
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // JWT & inter-service security
    JWT_SECRET:             z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    INTERNAL_SERVICE_TOKEN: z.string().min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),

    // Redis — used for distributed rate limiting
    REDIS_HOST:     z.string().min(1, "REDIS_HOST is required"),
    REDIS_PORT:     z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().default(""),

    // Trusted CORS origins for better-auth
    WEB_URL:   z.url("WEB_URL must be a valid URL"),
    ADMIN_URL: z.url("ADMIN_URL must be a valid URL"),
  },
  "auth-service"
)

export type AuthEnv = typeof env

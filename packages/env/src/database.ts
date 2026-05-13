import { z }        from "zod/v4"
import { parseEnv } from "./utils"

/**
 * Environment variables required by @repo/database.
 * Import as: import { env } from "@repo/env/database"
 */
export const env = parseEnv(
  {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // PostgreSQL — accepts postgres://, postgresql://
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // MongoDB — accepts mongodb://, mongodb+srv://
    MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),
  },
  "@repo/database"
)

export type DatabaseEnv = typeof env

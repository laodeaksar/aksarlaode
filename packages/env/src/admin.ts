import { z } from "zod/v4";

import { parseEnv } from "./utils";

/**
 * Environment variables required by admin.
 * Import as: import { env } from "@repo/env/admin"
 */
export const env = parseEnv(
  {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // PostgreSQL — accepts postgres://, postgresql://
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // MongoDB — accepts mongodb://, mongodb+srv://
    MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),
    INTERNAL_SERVICE_TOKEN: z
      .string()
      .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),

    // ── Public URLs ───────────────────────────────────────────────────────────
    PUBLIC_API_URL: z.url("PUBLIC_API_URL must be a valid URL"),
    WEB_URL: z.url("WEB_URL must be a valid URL"),
    ADMIN_URL: z.url("ADMIN_URL must be a valid URL"),
  },
  "admin"
);

export type DatabaseEnv = typeof env;

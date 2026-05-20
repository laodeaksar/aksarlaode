import { z } from "zod/v4";

import { parseEnv } from "./utils";

/**
 * Environment variables required by admin.
 * Import as: import { env } from "@repo/env/admin"
 *
 * Note: Admin is a TanStack Start SSR frontend that calls the API gateway.
 * It does NOT connect to databases directly — those are handled by backend services.
 */
export const env = parseEnv(
  {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Service-to-service auth token — needed for admin server functions
    // that call protected internal endpoints (audit log, etc.)
    INTERNAL_SERVICE_TOKEN: z
      .string()
      .min(1, "INTERNAL_SERVICE_TOKEN is required"),

    // ── Public URLs ───────────────────────────────────────────────────────────
    PUBLIC_API_URL: z.string().min(1, "PUBLIC_API_URL must be set"),
    WEB_URL: z.string().min(1, "WEB_URL must be set"),
    ADMIN_URL: z.string().min(1, "ADMIN_URL must be set"),
  },
  "admin"
);

export type AdminEnv = typeof env;
export type DatabaseEnv = typeof env;

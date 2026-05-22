import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by the admin SSR app.
 * Import as: import { env } from "@repo/env/admin"
 *
 * Admin is a TanStack Start SSR frontend that calls the API gateway.
 * It does NOT connect to databases directly — those are handled by backend services.
 */
export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.picklist(["development", "test", "production"]),
      "development"
    ),

    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(1, "INTERNAL_SERVICE_TOKEN is required")
    ),

    PUBLIC_API_URL: v.pipe(
      v.string(),
      v.url("PUBLIC_API_URL must be a valid URL")
    ),
    WEB_URL: v.pipe(v.string(), v.url("WEB_URL must be a valid URL")),
    ADMIN_URL: v.pipe(v.string(), v.url("ADMIN_URL must be a valid URL")),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [admin] Invalid environment variables:\n");
    for (const issue of error) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type AdminEnv = typeof env;

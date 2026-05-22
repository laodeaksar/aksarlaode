import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by product-service.
 * Import as: import { env } from "@repo/env/product"
 */
export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.picklist(["development", "test", "production"]),
      "development"
    ),

    DATABASE_URL: v.pipe(
      v.string(),
      v.minLength(1, "DATABASE_URL is required")
    ),

    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters")
    ),

    WEB_URL: v.pipe(v.string(), v.url("WEB_URL must be a valid URL")),
    ADMIN_URL: v.pipe(v.string(), v.url("ADMIN_URL must be a valid URL")),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [product-service] Invalid environment variables:\n");
    for (const issue of error.issues) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type ProductEnv = typeof env;

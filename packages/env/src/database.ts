import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by @repo/database.
 * Import as: import { env } from "@repo/env/database"
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
    MONGODB_URL: v.pipe(v.string(), v.minLength(1, "MONGODB_URL is required")),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [@repo/database] Invalid environment variables:\n");
    for (const issue of error) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type DatabaseEnv = typeof env;

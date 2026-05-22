import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by payment-service.
 * Import as: import { env } from "@repo/env/payment"
 */
export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.picklist(["development", "test", "production"]),
      "development"
    ),

    REDIS_URL: v.pipe(v.string(), v.minLength(1, "REDIS_URL is required")),

    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters")
    ),

    ORDER_SERVICE_URL: v.pipe(
      v.string(),
      v.url("ORDER_SERVICE_URL must be a valid URL")
    ),

    MIDTRANS_SERVER_KEY: v.pipe(
      v.string(),
      v.minLength(1, "MIDTRANS_SERVER_KEY is required")
    ),
    MIDTRANS_IS_PRODUCTION: v.optional(
      v.pipe(
        v.string(),
        v.transform((x) => x === "true" || x === "1")
      ),
      false
    ),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [payment-service] Invalid environment variables:\n");
    for (const issue of error.issues) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type PaymentEnv = typeof env;

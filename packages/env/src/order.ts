import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by order-service.
 * Import as: import { env } from "@repo/env/order"
 */
export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.picklist(["development", "test", "production"]),
      "development"
    ),

    MONGODB_URL: v.pipe(v.string(), v.minLength(1, "MONGODB_URL is required")),

    REDIS_URL: v.pipe(v.string(), v.minLength(1, "REDIS_URL is required")),

    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters")
    ),

    PRODUCT_SERVICE_URL: v.pipe(
      v.string(),
      v.url("PRODUCT_SERVICE_URL must be a valid URL")
    ),

    MIDTRANS_SERVER_KEY: v.pipe(
      v.string(),
      v.minLength(1, "MIDTRANS_SERVER_KEY is required")
    ),

    MINIMUM_ORDER_AMOUNT: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.minValue(0)
      ),
      1000
    ),

    PAYMENT_EXPIRY_MINUTES: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.integer(),
        v.minValue(1)
      ),
      60
    ),

    RECONCILIATION_INTERVAL_MS: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.integer(),
        v.minValue(1)
      ),
      300_000
    ),

    RATE_LIMIT_ORDER_CREATE_MAX: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.integer(),
        v.minValue(1)
      ),
      5
    ),

    RATE_LIMIT_ORDER_CREATE_WINDOW_MS: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.integer(),
        v.minValue(1)
      ),
      60_000
    ),

    RATE_LIMIT_WEBHOOK_MAX: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.integer(),
        v.minValue(1)
      ),
      60
    ),

    RATE_LIMIT_WEBHOOK_WINDOW_MS: v.optional(
      v.pipe(
        v.string(),
        v.transform(Number),
        v.number(),
        v.integer(),
        v.minValue(1)
      ),
      60_000
    ),

    WEB_URL: v.pipe(v.string(), v.url("WEB_URL must be a valid URL")),
    ADMIN_URL: v.pipe(v.string(), v.url("ADMIN_URL must be a valid URL")),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [order-service] Invalid environment variables:\n");
    for (const issue of error.issues) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type OrderEnv = typeof env;

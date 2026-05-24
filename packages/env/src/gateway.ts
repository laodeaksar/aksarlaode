import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Full environment schema for the API gateway.
 * Import as: import { env } from "@repo/env/gateway"
 */
export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.picklist(["development", "test", "production"]),
      "development"
    ),

    // ── Databases ────────────────────────────────────────────────────────────
    DATABASE_URL: v.pipe(
      v.string(),
      v.minLength(1, "DATABASE_URL is required")
    ),
    MONGODB_URL: v.pipe(v.string(), v.minLength(1, "MONGODB_URL is required")),

    // ── Cache ────────────────────────────────────────────────────────────────
    REDIS_URL: v.pipe(v.string(), v.minLength(1, "REDIS_URL is required")),

    // ── Auth & security ──────────────────────────────────────────────────────
    JWT_ACCESS_PUBLIC_KEY: v.pipe(
      v.string(),
      v.minLength(1, "JWT_ACCESS_PUBLIC_KEY is required")
    ),
    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters")
    ),

    // ── Internal service URLs ────────────────────────────────────────────────
    AUTH_SERVICE_URL: v.pipe(
      v.string(),
      v.url("AUTH_SERVICE_URL must be a valid URL")
    ),
    PRODUCT_SERVICE_URL: v.pipe(
      v.string(),
      v.url("PRODUCT_SERVICE_URL must be a valid URL")
    ),
    ORDER_SERVICE_URL: v.pipe(
      v.string(),
      v.url("ORDER_SERVICE_URL must be a valid URL")
    ),
    PAYMENT_SERVICE_URL: v.pipe(
      v.string(),
      v.url("PAYMENT_SERVICE_URL must be a valid URL")
    ),

    // ── Public URLs ───────────────────────────────────────────────────────────
    PUBLIC_API_URL: v.pipe(
      v.string(),
      v.url("PUBLIC_API_URL must be a valid URL")
    ),
    WEB_URL: v.pipe(v.string(), v.url("WEB_URL must be a valid URL")),
    ADMIN_URL: v.pipe(v.string(), v.url("ADMIN_URL must be a valid URL")),

    // ── Midtrans ──────────────────────────────────────────────────────────────
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
    PUBLIC_MIDTRANS_CLIENT_KEY: v.pipe(
      v.string(),
      v.minLength(1, "PUBLIC_MIDTRANS_CLIENT_KEY is required")
    ),

    // ── Mail (MailChannels sender identity) ───────────────────────────────────
    MAIL_FROM_ADDRESS: v.pipe(
      v.string(),
      v.email("MAIL_FROM_ADDRESS must be a valid email")
    ),
    MAIL_FROM_NAME: v.pipe(
      v.string(),
      v.minLength(1, "MAIL_FROM_NAME is required")
    ),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [api-gateway] Invalid environment variables:\n");
    for (const issue of error.issues) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type GatewayEnv = typeof env;

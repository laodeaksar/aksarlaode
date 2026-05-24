import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by email-worker.
 * Import as: import { env } from "@repo/env/email-worker"
 */
export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.picklist(["development", "test", "production"]),
      "development"
    ),

    // Redis — BullMQ consumer queue
    REDIS_URL: v.pipe(v.string(), v.minLength(1, "REDIS_URL is required")),

    // Auth-service URL — used by user-client to resolve userId → email/name
    AUTH_SERVICE_URL: v.pipe(
      v.string(),
      v.url("AUTH_SERVICE_URL must be a valid URL")
    ),

    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(1, "INTERNAL_SERVICE_TOKEN is required")
    ),

    // MailChannels sender identity
    MAIL_FROM_ADDRESS: v.pipe(
      v.string(),
      v.email("MAIL_FROM_ADDRESS must be a valid email")
    ),
    MAIL_FROM_NAME: v.pipe(
      v.string(),
      v.minLength(1, "MAIL_FROM_NAME is required")
    ),

    // Optional webhook URL for dead-letter alerts
    ALERT_WEBHOOK_URL: v.optional(v.pipe(v.string(), v.url())),
  },

  runtimeEnv: process.env,

  onValidationError: (issues) => {
    console.error("\n❌  [email-worker] Invalid environment variables:\n");
    for (const issue of issues) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type EmailWorkerEnv = typeof env;

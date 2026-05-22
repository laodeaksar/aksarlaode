import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

/**
 * Environment variables required by auth-service.
 * Import as: import { env } from "@repo/env/auth"
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

    // ── JWT keypairs (Ed25519 / EdDSA) ──────────────────────────────────────
    // Auth-service holds BOTH keys. The api-gateway receives ONLY the public
    // key — it can verify tokens but never forge them.
    // Key encoding: base64-encoded DER (PKCS8 private / SPKI public).
    JWT_ACCESS_PRIVATE_KEY: v.pipe(
      v.string(),
      v.minLength(1, "JWT_ACCESS_PRIVATE_KEY is required")
    ),
    JWT_ACCESS_PUBLIC_KEY: v.pipe(
      v.string(),
      v.minLength(1, "JWT_ACCESS_PUBLIC_KEY is required")
    ),
    JWT_REFRESH_PRIVATE_KEY: v.pipe(
      v.string(),
      v.minLength(1, "JWT_REFRESH_PRIVATE_KEY is required")
    ),
    JWT_REFRESH_PUBLIC_KEY: v.pipe(
      v.string(),
      v.minLength(1, "JWT_REFRESH_PUBLIC_KEY is required")
    ),

    INTERNAL_SERVICE_TOKEN: v.pipe(
      v.string(),
      v.minLength(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters")
    ),

    // Redis — single connection URL (redis://:password@host:port)
    REDIS_URL: v.pipe(v.string(), v.minLength(1, "REDIS_URL is required")),

    WEB_URL: v.pipe(v.string(), v.url("WEB_URL must be a valid URL")),
    ADMIN_URL: v.pipe(v.string(), v.url("ADMIN_URL must be a valid URL")),
  },

  runtimeEnv: process.env,

  onValidationError: (error) => {
    console.error("\n❌  [auth-service] Invalid environment variables:\n");
    for (const issue of error.issues) {
      console.error(`   ${issue.message}`);
    }
    console.error("\n   Check your .env file against .env.example\n");
    process.exit(1);
  },
});

export type AuthEnv = typeof env;

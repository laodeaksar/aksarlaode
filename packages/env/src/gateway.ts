import { z } from "zod/v4"

import { parseEnv } from "./utils"

/**
 * Full environment schema for the API gateway.
 * Every variable used across all services is validated here.
 * Import as: import { env } from "@repo/env/gateway"
 */
export const env = parseEnv(
  {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // ── Databases ────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),

    // ── Cache ────────────────────────────────────────────────────────────────
    REDIS_HOST: z.string().min(1, "REDIS_HOST is required"),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().default(""),

    // ── Auth & security ──────────────────────────────────────────────────────
    // Gateway receives ONLY the Ed25519 public key (SPKI DER, base64-encoded).
    // It verifies access tokens but can never sign or forge them — the private
    // key lives exclusively in auth-service.
    JWT_ACCESS_PUBLIC_KEY: z
      .string()
      .min(1, "JWT_ACCESS_PUBLIC_KEY is required"),
    INTERNAL_SERVICE_TOKEN: z
      .string()
      .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),

    // ── Internal service URLs ────────────────────────────────────────────────
    AUTH_SERVICE_URL: z.url("AUTH_SERVICE_URL must be a valid URL"),
    PRODUCT_SERVICE_URL: z.url("PRODUCT_SERVICE_URL must be a valid URL"),
    ORDER_SERVICE_URL: z.url("ORDER_SERVICE_URL must be a valid URL"),
    PAYMENT_SERVICE_URL: z.url("PAYMENT_SERVICE_URL must be a valid URL"),

    // ── Public URLs ───────────────────────────────────────────────────────────
    PUBLIC_API_URL: z.url("PUBLIC_API_URL must be a valid URL"),
    WEB_URL: z.url("WEB_URL must be a valid URL"),
    ADMIN_URL: z.url("ADMIN_URL must be a valid URL"),

    // ── Midtrans (payment gateway) ────────────────────────────────────────────
    MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY is required"),
    MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
    PUBLIC_MIDTRANS_CLIENT_KEY: z
      .string()
      .min(1, "PUBLIC_MIDTRANS_CLIENT_KEY is required"),

    // ── Mail ──────────────────────────────────────────────────────────────────
    MAIL_HOST: z.string().min(1, "MAIL_HOST is required"),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_USER: z.string().min(1, "MAIL_USER is required"),
    MAIL_PASS: z.string().min(1, "MAIL_PASS is required"),
    MAIL_FROM_ADDRESS: z.email("MAIL_FROM_ADDRESS must be a valid email"),
    MAIL_FROM_NAME: z.string().min(1, "MAIL_FROM_NAME is required"),
  },
  "api-gateway"
)

export type GatewayEnv = typeof env

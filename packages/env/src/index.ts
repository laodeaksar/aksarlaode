import { z } from "zod/v4"

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // PostgreSQL
  DATABASE_URL: z.url(),

  // MongoDB
  MONGODB_URL: z.url(),

  // Redis
  REDIS_HOST:     z.string(),
  REDIS_PORT:     z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string(),

  // Auth
  JWT_SECRET:             z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),

  // Service URLs
  AUTH_SERVICE_URL:    z.url(),
  PRODUCT_SERVICE_URL: z.url(),
  ORDER_SERVICE_URL:   z.url(),
  PAYMENT_SERVICE_URL: z.url(),

  // Public URLs
  PUBLIC_API_URL: z.url(),
  WEB_URL:        z.url(),
  ADMIN_URL:      z.url(),

  // Midtrans
  MIDTRANS_SERVER_KEY:       z.string(),
  MIDTRANS_IS_PRODUCTION:    z.coerce.boolean().default(false),
  PUBLIC_MIDTRANS_CLIENT_KEY: z.string(),

  // Mail
  MAIL_FROM_ADDRESS: z.email(),
  MAIL_FROM_NAME:    z.string(),
})

// Parse on import — crashes with clear message if misconfigured
const _env = schema.safeParse(process.env)

if (!_env.success) {
  console.error("❌ Invalid environment variables:")
  console.error(_env.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = _env.data
export type Env  = typeof _env.data

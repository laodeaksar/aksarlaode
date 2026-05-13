import { betterAuth }   from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db }           from "@repo/database"
import { env }          from "@repo/env"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  session: {
    expiresIn:          60 * 60 * 24 * 7,   // 7 days
    updateAge:          60 * 60 * 24,        // rotate if older than 1d
    cookieCache: {
      enabled:  true,
      maxAge:   60 * 5,                      // cache in cookie for 5min
    },
  },

  emailAndPassword: {
    enabled:            true,
    minPasswordLength:  8,
    autoSignIn:         false,               // explicit login after register
  },

  advanced: {
    cookiePrefix:       "ec",
    generateId:         () => crypto.randomUUID(),
  },

  trustedOrigins: [env.WEB_URL, env.ADMIN_URL],
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthUser    = typeof auth.$Infer.Session.user

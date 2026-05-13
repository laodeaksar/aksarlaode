import { cors as honoCors } from "hono/cors"
import { env } from "@repo/env"

export const cors = honoCors({
  origin: [env.WEB_URL, env.ADMIN_URL],
  allowMethods:  ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders:  ["Content-Type", "Authorization", "x-request-id"],
  exposeHeaders: ["x-request-id", "x-response-time"],
  credentials:   true,
  maxAge:        600,
})

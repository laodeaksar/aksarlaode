import { cors as honoCors } from "hono/cors";

import { env } from "@repo/env/gateway";

export const cors = honoCors({
  origin: [env.WEB_URL, env.ADMIN_URL],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "x-request-id",
    "Idempotency-Key", // C-01: tanpa ini browser POST dengan header ini gagal CORS preflight
  ],
  exposeHeaders: ["x-request-id", "x-response-time", "Idempotency-Replayed"],
  credentials: true,
  maxAge: 600,
});

import type { Context } from "hono";

import { env } from "@repo/env/gateway";

import type { AppEnv } from "@/types/context";

export function errorBoundary(err: Error, c: Context<AppEnv>) {
  console.error(
    JSON.stringify({
      event: "unhandled_error",
      requestId: c.var.requestId,
      message: err.message,
      stack: env.NODE_ENV === "development" ? err.stack : undefined,
    })
  );

  return c.json(
    {
      error: "Internal Server Error",
      code: "INTERNAL_ERROR",
      requestId: c.var.requestId,
    },
    500
  );
}

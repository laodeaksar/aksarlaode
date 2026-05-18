import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "@/types/context";

// FIX GW-05: Always generate a fresh UUID — never trust client-supplied
// x-request-id headers. A malicious client could inject a predictable ID
// to correlate internal log entries or poison tracing systems.
export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  c.set("startTime", Date.now());
  await next();
};

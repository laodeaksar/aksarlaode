import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "@/types/context";
import {
  DEFAULT_TIMEOUT_MS,
  SERVICE_REGISTRY,
  WEBHOOK_TIMEOUT_MS,
} from "@/proxy/service-registry";

// FIX GW-06: Timeout values now live in SERVICE_REGISTRY as the single source
// of truth. This middleware reads from there instead of duplicating the numbers.
function timeoutForPath(path: string): number {
  for (const { prefix, timeoutMs } of Object.values(SERVICE_REGISTRY)) {
    if (path.startsWith(prefix)) return timeoutMs;
  }
  if (path.startsWith("/webhooks")) return WEBHOOK_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

// ── Middleware ────────────────────────────────────────────────────────────────
export const requestTimeout: MiddlewareHandler<AppEnv> = async (c, next) => {
  const timeoutMs = timeoutForPath(c.req.path);
  const controller = new AbortController();

  // Expose the signal so proxy.ts can pass it to fetch() — this ensures the
  // upstream TCP connection is actually torn down, not just orphaned.
  c.set("abortSignal", controller.signal);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    await next();
  } catch (err) {
    // An AbortError here means proxy.ts re-threw after our signal fired.
    if (timedOut || (err instanceof Error && err.name === "AbortError")) {
      console.warn(
        JSON.stringify({
          event: "gateway_timeout",
          requestId: c.var.requestId,
          path: c.req.path,
          limitMs: timeoutMs,
        })
      );
      return c.json(
        {
          error: "Upstream service did not respond in time",
          code: "GATEWAY_TIMEOUT",
          requestId: c.var.requestId,
        },
        504
      );
    }
    throw err; // non-timeout errors propagate to errorBoundary
  } finally {
    clearTimeout(timer);
  }
};

import type { MiddlewareHandler } from "hono"
import type { AppEnv }          from "@/types/context"

// ── Per-prefix timeouts ───────────────────────────────────────────────────────
// Payment routes are generous because Midtrans (external gateway) can be slow.
// Auth routes are tight — they only hit the local DB.
const TIMEOUTS: ReadonlyArray<{ prefix: string; ms: number }> = [
  { prefix: "/auth",     ms: 10_000 },   // 10 s
  { prefix: "/products", ms: 15_000 },   // 15 s
  { prefix: "/orders",   ms: 20_000 },   // 20 s
  { prefix: "/payments", ms: 30_000 },   // 30 s — external payment gateway
  { prefix: "/webhooks", ms: 30_000 },   // 30 s — webhook processing
]
const DEFAULT_TIMEOUT_MS = 15_000        // 15 s

function timeoutForPath(path: string): number {
  for (const { prefix, ms } of TIMEOUTS) {
    if (path.startsWith(prefix)) return ms
  }
  return DEFAULT_TIMEOUT_MS
}

// ── Middleware ────────────────────────────────────────────────────────────────
export const requestTimeout: MiddlewareHandler<AppEnv> = async (c, next) => {
  const timeoutMs  = timeoutForPath(c.req.path)
  const controller = new AbortController()

  // Expose the signal so proxy.ts can pass it to fetch() — this ensures the
  // upstream TCP connection is actually torn down, not just orphaned.
  c.set("abortSignal", controller.signal)

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    await next()
  } catch (err) {
    // An AbortError here means proxy.ts re-threw after our signal fired.
    if (timedOut || (err instanceof Error && err.name === "AbortError")) {
      console.warn(JSON.stringify({
        event:     "gateway_timeout",
        requestId: c.var.requestId,
        path:      c.req.path,
        limitMs:   timeoutMs,
      }))
      return c.json(
        {
          error:     "Upstream service did not respond in time",
          code:      "GATEWAY_TIMEOUT",
          requestId: c.var.requestId,
        },
        504
      )
    }
    throw err   // non-timeout errors propagate to errorBoundary
  } finally {
    clearTimeout(timer)
  }
}

import { serve }              from "@hono/node-server"
import { Hono }               from "hono"
import { env }                from "@repo/env/gateway"
import { cors }               from "./middleware/cors"
import { requestId }          from "./middleware/request-id"
import { logger }             from "./middleware/logger"
import { rateLimiter }        from "./middleware/rate-limiter"
import { bodySizeLimiter }    from "./middleware/body-size-limiter"
import { requestTimeout }     from "./middleware/request-timeout"
import { authResolver }       from "./middleware/auth-resolver"
import { contextInjector }    from "./middleware/context-injector"
import { routeGuard }         from "./middleware/route-guard"
import { auditLog }           from "./middleware/audit-log"
import { idempotency }        from "./middleware/idempotency"
import { responseNormalizer } from "./middleware/response-normalizer"
import { errorBoundary }      from "./lib/errors"
import { getAllBreakerStatus, restoreAllBreakers } from "./lib/circuit-breaker"

import authRoutes    from "./routes/auth.routes"
import productRoutes from "./routes/product.routes"
import orderRoutes   from "./routes/order.routes"
import paymentRoutes from "./routes/payment.routes"
import webhookRoutes from "./routes/webhook.routes"

import type { AppEnv } from "./types/context"

const app = new Hono<AppEnv>()

// ── Health check — before all middleware so it always responds ────────────────
app.get("/health", (c) => {
  const circuits = getAllBreakerStatus()
  const degraded = circuits.some(b => b.state !== "CLOSED")
  return c.json({
    status:   degraded ? "degraded" : "ok",
    service:  "api-gateway",
    ts:       new Date().toISOString(),
    circuits,
  }, degraded ? 207 : 200)
})

// FIX GW-07: Internal-only circuit breaker state endpoint.
// Protected by x-service-token (timing-safe compare via constant-time string
// equality is sufficient here; full crypto.timingSafeEqual would require
// equal-length buffers — we rely on the secret being ≥32 chars).
// Not mounted under the global middleware chain to avoid rate-limiter /
// auth-resolver adding overhead to ops tooling calls.
app.get("/internal/health/breakers", (c) => {
  const token = c.req.header("x-service-token") ?? ""
  if (!token || token !== env.INTERNAL_SERVICE_TOKEN) {
    return c.json({ error: "Unauthorized", code: "INVALID_SERVICE_TOKEN" }, 401)
  }
  const circuits = getAllBreakerStatus()
  const degraded = circuits.some(b => b.state !== "CLOSED")
  return c.json({
    status:   degraded ? "degraded" : "ok",
    service:  "api-gateway",
    ts:       new Date().toISOString(),
    circuits,
  }, degraded ? 207 : 200)
})

// ── Global middleware (order is strict) ───────────────────────────────────────
app.use("*", cors)
app.use("*", requestId)
app.use("*", logger)
app.use("*", rateLimiter)
app.use("*", bodySizeLimiter)
app.use("*", requestTimeout)
app.use("*", authResolver)       // populates c.var.authPayload or short-circuits 401
app.use("*", contextInjector)    // promotes authPayload → c.var.user (typed User | null)
app.use("*", auditLog)           // structured audit trail (after user is known, before RBAC)
app.use("*", idempotency)        // POST deduplication via Idempotency-Key header
app.use("*", routeGuard)         // RBAC enforcement
app.use("*", responseNormalizer) // sets x-request-id / x-response-time headers

// ── Route tree ────────────────────────────────────────────────────────────────
app.route("/auth",     authRoutes)
app.route("/products", productRoutes)
app.route("/orders",   orderRoutes)
app.route("/payments", paymentRoutes)
app.route("/webhooks", webhookRoutes)

// ── Unhandled error boundary ──────────────────────────────────────────────────
app.onError(errorBoundary)

// ── Start server ──────────────────────────────────────────────────────────────
// FIX GW-02: restore persisted circuit-breaker states from Redis before
// accepting any traffic. A rolling restart must not silently reset OPEN
// breakers and flood a still-failing downstream with requests.
const PORT = Number(process.env.PORT ?? 3000)

restoreAllBreakers().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.info(JSON.stringify({
      event:   "server_started",
      service: "api-gateway",
      port:    PORT,
      env:     env.NODE_ENV,
    }))
  })
})

export default app

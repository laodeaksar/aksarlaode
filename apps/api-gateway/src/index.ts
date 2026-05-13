import { serve }              from "@hono/node-server"
import { Hono }               from "hono"
import { env }                from "@repo/env/gateway"
import { cors }               from "./middleware/cors"
import { requestId }          from "./middleware/request-id"
import { logger }             from "./middleware/logger"
import { rateLimiter }        from "./middleware/rate-limiter"
import { authResolver }       from "./middleware/auth-resolver"
import { contextInjector }    from "./middleware/context-injector"
import { routeGuard }         from "./middleware/route-guard"
import { responseNormalizer } from "./middleware/response-normalizer"
import { errorBoundary }      from "./lib/errors"

import authRoutes    from "./routes/auth.routes"
import productRoutes from "./routes/product.routes"
import orderRoutes   from "./routes/order.routes"
import paymentRoutes from "./routes/payment.routes"
import webhookRoutes from "./routes/webhook.routes"

import type { AppEnv } from "./types/context"

const app = new Hono<AppEnv>()

// ── Health check — before all middleware so it always responds ────────────────
app.get("/health", (c) =>
  c.json({ status: "ok", service: "api-gateway", ts: new Date().toISOString() })
)

// ── Global middleware (order is strict) ───────────────────────────────────────
app.use("*", cors)
app.use("*", requestId)
app.use("*", logger)
app.use("*", rateLimiter)
app.use("*", authResolver)       // populates c.var.authPayload or short-circuits 401
app.use("*", contextInjector)    // promotes authPayload → c.var.user (typed User | null)
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
const PORT = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port: PORT }, () => {
  console.info(JSON.stringify({
    event:   "server_started",
    service: "api-gateway",
    port:    PORT,
    env:     env.NODE_ENV,
  }))
})

export default app

import { Hono } from "hono"
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

// ── Global middleware (order is strict) ───────────────────
app.use("*", cors)
app.use("*", requestId)
app.use("*", logger)
app.use("*", rateLimiter)
app.use("*", authResolver)       // sets c.var.authPayload or short-circuits
app.use("*", contextInjector)    // promotes authPayload → c.var.user
app.use("*", routeGuard)         // RBAC check
app.use("*", responseNormalizer) // wraps response on the way out

// ── Routes ────────────────────────────────────────────────
app.route("/auth",     authRoutes)
app.route("/products", productRoutes)
app.route("/orders",   orderRoutes)
app.route("/payments", paymentRoutes)
app.route("/webhooks", webhookRoutes)

// ── Error boundary (catches anything unhandled) ───────────
app.onError(errorBoundary)

export default app

import Elysia, { t } from "elysia"
import { cors }      from "@elysiajs/cors"
import { swagger }   from "@elysiajs/swagger"
import { connectMongo } from "@repo/database"
import { env }       from "@repo/env/order"
import { orderRoutes }             from "./routes/order.routes"
import { adminRoutes }             from "./routes/admin.routes"
import { paymentWebhookHandler }   from "./handlers/payment-webhook"
import { createReconciliationWorker, scheduleReconciliationJob } from "./workers/reconciliation.worker"
import { healthHandler }             from "./handlers/health"

const PORT = Number(process.env.PORT) || 3003

const app = new Elysia()

  .use(swagger({
    documentation: {
      info: {
        title:       "Order Service API",
        version:     "1.0.0",
        description: "Internal API for managing the order lifecycle.",
      },
      tags: [
        { name: "Orders",  description: "Order lifecycle management" },
        { name: "Admin",   description: "Admin operations" },
        { name: "Webhook", description: "Payment gateway callbacks" },
        { name: "Health",  description: "Service health check" },
      ],
    },
    // Restrict docs to non-production environments
    path: env.NODE_ENV === "production" ? "/_internal/docs" : "/docs",
  }))

  .use(cors({
    origin:         [env.WEB_URL, env.ADMIN_URL],
    allowedHeaders: ["Content-Type", "x-service-token", "x-user-id", "x-user-role", "x-request-id", "idempotency-key"],
    methods:        ["GET", "POST", "PATCH", "OPTIONS"],
    credentials:    false,
  }))

  .onRequest(({ request, headers }) => {
    console.info(JSON.stringify({
      event:     "request_in",
      method:    request.method,
      path:      new URL(request.url).pathname,
      requestId: headers["x-request-id"] ?? null,
      userId:    headers["x-user-id"]    ?? null,
    }))
  })

  .get("/health", healthHandler, {
    response: {
      200: t.Object({
        status:    t.Union([t.Literal("healthy"), t.Literal("degraded")]),
        service:   t.String(),
        uptimeSec: t.Number(),
        checks: t.Object({
          mongodb:        t.Object({ status: t.String(), latencyMs: t.Number(), error: t.Optional(t.String()) }),
          redis:          t.Object({ status: t.String(), latencyMs: t.Number(), error: t.Optional(t.String()) }),
          productService: t.Object({ status: t.String(), latencyMs: t.Number(), error: t.Optional(t.String()) }),
        }),
      }),
      503: t.Object({
        status:    t.Literal("unhealthy"),
        service:   t.String(),
        uptimeSec: t.Number(),
        checks: t.Object({
          mongodb:        t.Object({ status: t.String(), latencyMs: t.Number(), error: t.Optional(t.String()) }),
          redis:          t.Object({ status: t.String(), latencyMs: t.Number(), error: t.Optional(t.String()) }),
          productService: t.Object({ status: t.String(), latencyMs: t.Number(), error: t.Optional(t.String()) }),
        }),
      }),
    },
    detail: {
      tags:        ["Health"],
      summary:     "Dependency health check",
      description: [
        "Probes MongoDB, Redis, and product-service in parallel (3 s timeout each).",
        "Returns 200 for 'healthy' (all ok) or 'degraded' (partial failure).",
        "Returns 503 for 'unhealthy' (all checks failed) — load balancers should pull the instance.",
        "Each check reports its own latency and error message for rapid diagnosis.",
      ].join(" "),
    },
  })

  // ── Payment gateway webhook — public endpoint, guarded by Midtrans HMAC ──
  //    Registered BEFORE orderRoutes so it bypasses the service-token guard.
  .post("/webhooks/payment", paymentWebhookHandler, {
    detail: {
      tags:    ["Webhook"],
      summary: "Midtrans payment notification",
      description: "Receives Midtrans HTTP notification. Validates SHA-512 HMAC signature before processing. Idempotent — duplicate deliveries of the same transaction_id are safely ignored.",
    },
  })

  .use(adminRoutes)

  .use(orderRoutes)

  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404
      return { error: "Route not found", code: "NOT_FOUND" }
    }
    // Log message only — never expose stack trace or internal error details
    console.error(JSON.stringify({ event: "unhandled_error", code, message: error.message }))
    set.status = 500
    return { error: "Internal server error", code: "INTERNAL_ERROR" }
  })

async function main() {
  await connectMongo()

  // ── Start reconciliation worker + schedule repeatable sweep job ───────────
  const reconciliationWorker = createReconciliationWorker()
  await scheduleReconciliationJob()

  app.listen(PORT)
  console.info(`📦 order-service running on port ${PORT}`)
  console.info(`📄 API docs available at http://localhost:${PORT}${env.NODE_ENV === "production" ? "/_internal/docs" : "/docs"}`)

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}, shutting down...`)
    await reconciliationWorker.close()
    await app.stop()
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT",  () => shutdown("SIGINT"))
}

main().catch((err) => {
  console.error("Failed to start order-service:", err)
  process.exit(1)
})

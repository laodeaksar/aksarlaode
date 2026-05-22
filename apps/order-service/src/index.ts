import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import Elysia, { t } from "elysia";

import { connectMongo } from "@repo/database";
import { env } from "@repo/env/order";

import { healthHandler } from "./handlers/health";
import { paymentWebhookHandler } from "./handlers/payment-webhook";
import { startConfigWatcher } from "./lib/store-config";
import { requestLogger } from "./lib/request-logger";
import { adminRoutes } from "./routes/admin.routes";
import { orderRoutes } from "./routes/order.routes";
import {
  createReconciliationWorker,
  scheduleReconciliationJob,
} from "./workers/reconciliation.worker";

const PORT = Number(process.env.PORT) || 3003;

const app = new Elysia()

  .use(
    swagger({
      documentation: {
        info: {
          title: "Order Service API",
          version: "1.0.0",
          description: "Internal API for managing the order lifecycle.",
        },
        tags: [
          { name: "Orders", description: "Order lifecycle management" },
          { name: "Admin", description: "Admin operations" },
          { name: "Webhook", description: "Payment gateway callbacks" },
          { name: "Health", description: "Service health check" },
        ],
      },
      // Restrict docs to non-production environments
      path: env.NODE_ENV === "production" ? "/_internal/docs" : "/docs",
    })
  )

  .use(
    cors({
      origin: [env.WEB_URL, env.ADMIN_URL],
      allowedHeaders: [
        "Content-Type",
        "x-service-token",
        "x-user-id",
        "x-user-role",
        "x-request-id",
        "idempotency-key",
      ],
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      credentials: false,
    })
  )

  // ── Structured per-request logging — one JSON line emitted on completion ──
  .use(requestLogger)

  .get("/health", healthHandler, {
    response: {
      200: t.Object({
        status: t.Union([t.Literal("healthy"), t.Literal("degraded")]),
        service: t.String(),
        uptimeSec: t.Number(),
        checks: t.Object({
          mongodb: t.Object({
            status: t.String(),
            latencyMs: t.Number(),
            error: t.Optional(t.String()),
          }),
          redis: t.Object({
            status: t.String(),
            latencyMs: t.Number(),
            error: t.Optional(t.String()),
          }),
          productService: t.Object({
            status: t.String(),
            latencyMs: t.Number(),
            error: t.Optional(t.String()),
          }),
        }),
      }),
      503: t.Object({
        status: t.Literal("unhealthy"),
        service: t.String(),
        uptimeSec: t.Number(),
        checks: t.Object({
          mongodb: t.Object({
            status: t.String(),
            latencyMs: t.Number(),
            error: t.Optional(t.String()),
          }),
          redis: t.Object({
            status: t.String(),
            latencyMs: t.Number(),
            error: t.Optional(t.String()),
          }),
          productService: t.Object({
            status: t.String(),
            latencyMs: t.Number(),
            error: t.Optional(t.String()),
          }),
        }),
      }),
    },
    detail: {
      tags: ["Health"],
      summary: "Dependency health check",
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
      tags: ["Webhook"],
      summary: "Midtrans payment notification",
      description:
        "Receives Midtrans HTTP notification. Validates SHA-512 HMAC signature before processing. Idempotent — duplicate deliveries of the same transaction_id are safely ignored.",
    },
  })

  .use(adminRoutes)

  .use(orderRoutes)

  // ── Error response shaper — logging is handled by requestLogger plugin ────
  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found", code: "NOT_FOUND" };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "Validation failed",
        code: "VALIDATION",
        detail: error.message,
      };
    }
    if (code === "PARSE") {
      set.status = 400;
      return { error: "Invalid request body", code: "PARSE_ERROR" };
    }
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  });

async function main() {
  await connectMongo();

  // Subscribe to Redis store:config:updated so live setting changes
  // (written by the admin settings page) reload without a restart.
  startConfigWatcher();

  // ── Start reconciliation worker + schedule repeatable sweep job ───────────
  const reconciliationWorker = createReconciliationWorker();
  await scheduleReconciliationJob();

  app.listen(PORT);
  console.info(`📦 order-service running on port ${PORT}`);
  console.info(
    `📄 API docs available at http://localhost:${PORT}${env.NODE_ENV === "production" ? "/_internal/docs" : "/docs"}`
  );

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}, shutting down...`);
    await reconciliationWorker.close();
    await app.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start order-service:", err);
  process.exit(1);
});

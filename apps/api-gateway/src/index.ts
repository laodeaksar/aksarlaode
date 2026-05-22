import { timingSafeEqual } from "node:crypto";

import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "@repo/env/gateway";

import { getAllBreakerStatus, restoreAllBreakers } from "./lib/circuit-breaker";
import { errorBoundary } from "./lib/errors";
import { auditLog } from "./middleware/audit-log";
import { authResolver } from "./middleware/auth-resolver";
import { bodySizeLimiter } from "./middleware/body-size-limiter";
import { contextInjector } from "./middleware/context-injector";
import { cors } from "./middleware/cors";
import { idempotency } from "./middleware/idempotency";
import { logger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rate-limiter";
import { requestId } from "./middleware/request-id";
import { requestTimeout } from "./middleware/request-timeout";
import { responseNormalizer } from "./middleware/response-normalizer";
import { routeGuard } from "./middleware/route-guard";
import authRoutes from "./routes/auth.routes";
import orderRoutes from "./routes/orders.routes";
import paymentRoutes from "./routes/payments.routes";
import productRoutes from "./routes/products.routes";
import settingsRoutes from "./routes/settings.routes";
import webhookRoutes from "./routes/webhooks.routes";
import type { AppEnv } from "./types/context";

const app = new Hono<AppEnv>();

// ── Health check — before all middleware so it always responds ────────────────
// C-06: always return 200 — load balancers and monitoring probes interpret any
// 2xx as healthy; signal degraded state via the `status` field in the body.
// 207 (Multi-Status / WebDAV) was wrong and caused probes to miss degraded state.
app.get("/health", (c) => {
  const circuits = getAllBreakerStatus();
  const degraded = circuits.some((b) => b.state !== "CLOSED");
  return c.json({
    status: degraded ? "degraded" : "ok",
    service: "api-gateway",
    ts: new Date().toISOString(),
    circuits,
  });
});

// Internal-only circuit breaker state endpoint.
// C-04: uses timingSafeEqual to prevent timing side-channel attacks — a simple
// string !== comparison leaks information character-by-character via response
// time differences, allowing an attacker to brute-force the token.
// Not mounted under the global middleware chain to avoid rate-limiter /
// auth-resolver adding overhead to ops tooling calls.
app.get("/internal/health/breakers", (c) => {
  const token = c.req.header("x-service-token") ?? "";
  const expected = env.INTERNAL_SERVICE_TOKEN;

  // timingSafeEqual requires equal-length Buffers — pad the received token
  // to the expected length before comparing so the function never throws.
  // A length mismatch is still correctly detected because we compare lengths
  // separately (the pad fill character "\0" cannot appear in a real token).
  const tokenBuf = Buffer.from(token.padEnd(expected.length, "\0"));
  const expectedBuf = Buffer.from(expected);
  const valid =
    token.length === expected.length && timingSafeEqual(tokenBuf, expectedBuf);

  if (!valid) {
    return c.json(
      { error: "Unauthorized", code: "INVALID_SERVICE_TOKEN" },
      401
    );
  }

  const circuits = getAllBreakerStatus();
  const degraded = circuits.some((b) => b.state !== "CLOSED");
  // C-06: consistent with /health — always 200, caller checks `status` field
  return c.json({
    status: degraded ? "degraded" : "ok",
    service: "api-gateway",
    ts: new Date().toISOString(),
    circuits,
  });
});

// ── Global middleware (order is strict) ───────────────────────────────────────
app.use("*", cors);
app.use("*", requestId);
app.use("*", logger);
app.use("*", rateLimiter);
app.use("*", bodySizeLimiter);
app.use("*", requestTimeout);
app.use("*", authResolver); // populates c.var.authPayload or short-circuits 401
app.use("*", contextInjector); // promotes authPayload → c.var.user (typed User | null)
app.use("*", auditLog); // structured audit trail (after user is known, before RBAC)
app.use("*", idempotency); // POST deduplication via Idempotency-Key header
app.use("*", routeGuard); // RBAC enforcement
app.use("*", responseNormalizer); // sets x-request-id / x-response-time headers

// ── Route tree ────────────────────────────────────────────────────────────────
// C-09: Routes are mounted under both /v1 (new canonical) and / (legacy, deprecated).
// Clients should migrate to /v1 endpoints. The unversioned mounts will be removed
// once all consumers have updated. Log a deprecation warning if needed via logger.
app.route("/v1/auth", authRoutes);
app.route("/v1/products", productRoutes);
app.route("/v1/orders", orderRoutes);
app.route("/v1/payments", paymentRoutes);
app.route("/v1/webhooks", webhookRoutes);
// Settings are handled inline (not proxied) — gateway owns DB + Redis pub/sub
app.route("/v1/admin/settings", settingsRoutes);

// Legacy unversioned mounts — deprecated, kept for backward compatibility
app.route("/auth", authRoutes);
app.route("/products", productRoutes);
app.route("/orders", orderRoutes);
app.route("/payments", paymentRoutes);
app.route("/webhooks", webhookRoutes);
app.route("/admin/settings", settingsRoutes);

// ── Unhandled error boundary ──────────────────────────────────────────────────
app.onError(errorBoundary);

// ── Start server ──────────────────────────────────────────────────────────────
// FIX GW-02: restore persisted circuit-breaker states from Redis before
// accepting any traffic. A rolling restart must not silently reset OPEN
// breakers and flood a still-failing downstream with requests.
const PORT = parseInt(process.env.PORT ?? "3000", 10) || 3000;

restoreAllBreakers().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.info(
      JSON.stringify({
        event: "server_started",
        service: "api-gateway",
        port: PORT,
        env: env.NODE_ENV,
      })
    );
  });
});

export default app;

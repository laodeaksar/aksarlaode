import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import Elysia from "elysia";

import { env } from "@repo/env/product";

import { withUserContext } from "./plugins/user-context";
import { productRoutes } from "./routes/product.routes";

const PORT = parseInt(process.env["PORT"] ?? "3002", 10);

// ── Service token guard ────────────────────────────────────────────────────
const serviceToken = (app: Elysia) =>
  app.onBeforeHandle(({ headers, set }) => {
    if (headers["x-service-token"] !== env.INTERNAL_SERVICE_TOKEN) {
      set.status = 401;
      return { error: "Unauthorized", code: "UNAUTHORIZED" };
    }
  });

const app = new Elysia()

  // ── API docs (mounted before auth so /docs is accessible in dev) ──────────
  .use(
    swagger({
      documentation: {
        info: {
          title: "Product Service API",
          version: "1.0.0",
          description:
            "Internal API for managing products. All endpoints require the `x-service-token` header.",
        },
        tags: [
          { name: "Products", description: "CRUD operations on products" },
          { name: "Health", description: "Service health check" },
        ],
        components: {
          securitySchemes: {
            serviceToken: {
              type: "apiKey",
              in: "header",
              name: "x-service-token",
            },
          },
        },
        security: [{ serviceToken: [] }],
      },
      path: "/docs",
    })
  )

  // ── CORS ──────────────────────────────────────────────────────────────────
  .use(
    cors({
      origin: [env.WEB_URL, env.ADMIN_URL],
      allowedHeaders: [
        "Content-Type",
        "x-service-token",
        "x-user-id",
        "x-user-role",
        "x-request-id",
      ],
    })
  )

  // ── Auth & user context ───────────────────────────────────────────────────
  .use(serviceToken)
  .use(withUserContext)

  // ── Request logger (requestId available here after derive) ─────────────
  .onRequest(({ request }) => {
    console.info(
      JSON.stringify({
        event: "request_in",
        method: request.method,
        path: new URL(request.url).pathname,
        requestId: request.headers.get("x-request-id"),
        userId: request.headers.get("x-user-id"),
      })
    );
  })

  // ── Routes ────────────────────────────────────────────────────────────────
  .get("/health", () => ({ status: "ok", service: "product-service" }), {
    detail: { tags: ["Health"], summary: "Health check" },
  })
  .use(productRoutes)

  // ── Global error handler ──────────────────────────────────────────────────
  .onError(({ code, error, set }) => {
    // Validation errors — structured per-field response
    if (code === "VALIDATION") {
      set.status = 422;

      const err = error as any;
      const fields: Array<{ field: string; message: string }> = [];
      if (err?.validator?.Errors) {
        for (const e of err.validator.Errors(err.value ?? {})) {
          fields.push({
            field: String(e.path).replace(/^\//, "") || "root",
            message: String(e.message),
          });
        }
      }

      console.warn(
        JSON.stringify({
          event: "validation_error",
          source: err?.on ?? "request",
          fields,
        })
      );

      return {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        source: err?.on ?? "request",
        fields,
      };
    }

    // Route not found
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found", code: "NOT_FOUND" };
    }

    // Unhandled errors
    console.error(
      JSON.stringify({ event: "unhandled_error", code, message: (error as Error).message })
    );
    set.status = 500;
    return { error: "Internal server error", code: "INTERNAL_ERROR" };
  })

  .listen(PORT);

console.info(`📦 product-service running on http://localhost:${PORT}`);
console.info(`📄 API docs available at http://localhost:${PORT}/docs`);

const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, shutting down...`);
  await app.stop();
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

import { Elysia }   from "elysia"
import { cors }     from "@elysiajs/cors"
import { swagger }  from "@elysiajs/swagger"
import { env }      from "@repo/env/auth"
import authRoutes    from "./routes/auth.routes"
import sessionRoutes from "./routes/session.routes"
import adminRoutes   from "./routes/admin.routes"
import { serviceTokenMiddleware } from "./middleware/service-token"

const PORT = parseInt(process.env["PORT"] ?? "3001", 10)

const DOCS_PATH = env.NODE_ENV === "production" ? "/_internal/docs" : "/docs"

const app = new Elysia()

  // ── API docs (mounted before auth guard so /docs is reachable in dev) ───────
  .use(swagger({
    documentation: {
      info: {
        title:       "Auth Service API",
        version:     "1.0.0",
        description: "Handles authentication, session management, and user administration for the platform.",
      },
      tags: [
        { name: "Auth",     description: "Login, register, token refresh, profile and password management" },
        { name: "Sessions", description: "List and revoke active user sessions" },
        { name: "Admin",    description: "User management — requires ADMIN or OWNER role" },
        { name: "Owner",    description: "Ownership transfer — requires OWNER role" },
        { name: "Health",   description: "Service health check" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type:         "http",
            scheme:       "bearer",
            bearerFormat: "JWT",
            description:  "Short-lived access token issued by POST /auth/login or POST /auth/refresh.",
          },
          serviceToken: {
            type:        "apiKey",
            in:          "header",
            name:        "x-service-token",
            description: "Internal service-to-service token required by the API gateway.",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    path: DOCS_PATH,
  }))

  .use(cors({
    origin:         [env.WEB_URL, env.ADMIN_URL],
    allowedHeaders: ["Content-Type", "Authorization", "x-service-token", "x-user-id", "x-request-id"],
    credentials:    true,
  }))

  .onRequest(({ request, store }) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
    ;(store as Record<string, string>)["requestId"] = requestId
    console.info(JSON.stringify({
      event:     "request_in",
      requestId,
      method:    request.method,
      path:      new URL(request.url).pathname,
    }))
  })

  .onBeforeHandle(serviceTokenMiddleware)

  .get("/health", () => ({ status: "ok", service: "auth-service" }), {
    detail: { tags: ["Health"], summary: "Health check" },
  })

  .use(authRoutes)
  .use(sessionRoutes)
  .use(adminRoutes)

  .onError(({ code, error, set }) => {
    console.error(JSON.stringify({
      event:   "unhandled_error",
      code,
      message: error.message,
    }))

    if (code === "VALIDATION") {
      set.status = 422
      return { error: "Validation failed", code: "VALIDATION_ERROR" }
    }
    if (code === "NOT_FOUND") {
      set.status = 404
      return { error: "Route not found", code: "NOT_FOUND" }
    }

    set.status = 500
    return { error: "Internal server error", code: "INTERNAL_ERROR" }
  })

  .listen(PORT)

console.info(`🔐 auth-service running on http://localhost:${PORT}`)
console.info(`📄 API docs available at http://localhost:${PORT}${DOCS_PATH}`)

const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, shutting down...`)
  await app.stop()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

export type App = typeof app

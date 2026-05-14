import { serve }     from "@hono/node-server"
import { Hono }      from "hono"
import authRoutes    from "./routes/auth.routes"
import sessionRoutes from "./routes/session.routes"
import type { AppEnv } from "./types"

const PORT = parseInt(process.env["PORT"] ?? "3001", 10)

const app = new Elysia()

  // ── Global middleware ─────────────────────────────────
  .use(cors({
    origin:          [env.WEB_URL, env.ADMIN_URL],
    allowedHeaders:  ["Content-Type", "Authorization", "x-service-token", "x-user-id", "x-request-id"],
    credentials:     true,
  }))

  // Request logger
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

  // Service token guard — every route requires this
  .onBeforeHandle(serviceTokenMiddleware)

  // ── Health ─────────────────────────────────────────────
  .get("/health", () => ({ status: "ok", service: "auth-service" }))

  // ── Routes ─────────────────────────────────────────────

.route("/auth",    authRoutes)
.route("/session", sessionRoutes)


 // .use(authRoutes)

  // ── Error handler ──────────────────────────────────────
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

// ── Graceful shutdown ──────────────────────────────────────
const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, shutting down...`)
  await app.stop()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

export type App = typeof app

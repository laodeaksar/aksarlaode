import { Elysia }  from "elysia"
import { cors }    from "@elysiajs/cors"
import { env }     from "@repo/env/auth"
import authRoutes    from "./routes/auth.routes"
import sessionRoutes from "./routes/session.routes"
import { serviceTokenMiddleware } from "./middleware/service-token"

const PORT = parseInt(process.env["PORT"] ?? "3001", 10)

const app = new Elysia()

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

  .get("/health", () => ({ status: "ok", service: "auth-service" }))

  .use(authRoutes)
  .use(sessionRoutes)

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

const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, shutting down...`)
  await app.stop()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

export type App = typeof app

import Elysia   from "elysia"
import { cors } from "@elysiajs/cors"
import productRoutes     from "./routes/product.routes"
import type { AppEnv }  from "./types"

const PORT = parseInt(process.env["PORT"] ?? "3002", 10)

// ── Service token guard ────────────────────────────────────
const serviceToken = (app: Elysia) =>
  app.onBeforeHandle(({ headers, set }) => {
    if (headers["x-service-token"] !== env.INTERNAL_SERVICE_TOKEN) {
      set.status = 401
      return { error: "Unauthorized", code: "UNAUTHORIZED" }
    }
  })

const app = new Elysia()
.use(cors({
    origin:         [env.WEB_URL, env.ADMIN_URL],
    allowedHeaders: ["Content-Type", "x-service-token", "x-user-id", "x-user-role", "x-request-id"],
  }))

  .use(serviceToken)
  // Logger
  .onRequest(({ request }) => {
    console.info(JSON.stringify({
      event:  "request_in",
      method: request.method,
      path:   new URL(request.url).pathname,
    }))
  })

  // health
.get("/health", () => ({ status: "ok", service: "product-service" }))

  .route("/products", productRoutes)
.onError(({ code, error, set }) => {
    console.error(JSON.stringify({ event: "unhandled_error", code, message: error.message }))
    if (code === "NOT_FOUND") { set.status = 404; return { error: "Route not found", code: "NOT_FOUND" } }
    set.status = 500
    return { error: "Internal server error", code: "INTERNAL_ERROR" }
  })

  .listen(PORT)

console.info(`📦 product-service running on http://localhost:${PORT}`)

const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, shutting down...`)
  await app.stop()
  process.exit(0)
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

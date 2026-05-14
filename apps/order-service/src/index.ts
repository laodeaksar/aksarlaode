import Elysia        from "elysia"
import { cors }      from "@elysiajs/cors"
import { swagger }   from "@elysiajs/swagger"
import { connectMongo } from "@repo/database"
import { env }       from "@repo/env/order"
import { orderRoutes } from "./routes/order.routes"

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
        { name: "Orders", description: "Order lifecycle management" },
        { name: "Health", description: "Service health check" },
      ],
    },
    path: "/docs",
  }))

  .use(cors({
    origin:         [env.WEB_URL, env.ADMIN_URL],
    allowedHeaders: ["Content-Type", "x-service-token", "x-user-id", "x-user-role", "x-request-id"],
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

  .get("/health", () => ({ status: "ok", service: "order-service" }), {
    detail: { tags: ["Health"], summary: "Health check" },
  })

  .use(orderRoutes)

  .onError(({ code, error, set }) => {
    if (code === "NOT_FOUND") {
      set.status = 404
      return { error: "Route not found", code: "NOT_FOUND" }
    }
    console.error(JSON.stringify({ event: "unhandled_error", code, message: error.message }))
    set.status = 500
    return { error: "Internal server error", code: "INTERNAL_ERROR" }
  })

async function main() {
  await connectMongo()
  app.listen(PORT)
  console.info(`📦 order-service running on port ${PORT}`)
  console.info(`📄 API docs available at http://localhost:${PORT}/docs`)
}

main().catch((err) => {
  console.error("Failed to start order-service:", err)
  process.exit(1)
})

const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, shutting down...`)
  await app.stop()
  process.exit(0)
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

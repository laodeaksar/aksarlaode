import { serve }         from "@hono/node-server"
import { Hono }          from "hono"
import { connectMongo }  from "@repo/database"
import orderRoutes       from "./routes/order.routes"
import type { AppEnv }  from "./types"

const app = new Hono<AppEnv>()

app.route("/orders", orderRoutes)
app.get("/health", (c) => c.json({ status: "ok", service: "order" }))

const PORT = Number(process.env.PORT) || 3003

connectMongo().then(() => {
  serve({ fetch: app.fetch, port: PORT, hostname: "localhost" }, () => {
    console.info(`Order service running on port ${PORT}`)
  })
}).catch((err) => {
  console.error("Failed to connect to MongoDB:", err)
  process.exit(1)
})

export default app

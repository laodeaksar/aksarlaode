import { serve }         from "@hono/node-server"
import { Hono }          from "hono"
import productRoutes     from "./routes/product.routes"
import type { AppEnv }  from "./types"

const app = new Hono<AppEnv>()

app.route("/products", productRoutes)
app.get("/health", (c) => c.json({ status: "ok", service: "product" }))

const PORT = Number(process.env.PORT) || 3002
serve({ fetch: app.fetch, port: PORT, hostname: "localhost" }, () => {
  console.info(`Product service running on port ${PORT}`)
})

export default app

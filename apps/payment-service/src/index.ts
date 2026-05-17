import { serve } from "@hono/node-server"
import { Hono } from "hono"

import paymentRoutes from "./routes/payment.routes"
import webhookRoutes from "./routes/webhook.routes"
import type { AppEnv } from "./types"

const app = new Hono<AppEnv>()

app.route("/payments", paymentRoutes)
app.route("/webhooks", webhookRoutes)
app.get("/health", (c) => c.json({ status: "ok", service: "payment" }))

const PORT = Number(process.env.PORT) || 3004
serve({ fetch: app.fetch, port: PORT, hostname: "localhost" }, () => {
  console.info(`Payment service running on port ${PORT}`)
})

export default app

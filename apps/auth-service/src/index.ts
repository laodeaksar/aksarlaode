import { serve }     from "@hono/node-server"
import { Hono }      from "hono"
import authRoutes    from "./routes/auth.routes"
import sessionRoutes from "./routes/session.routes"
import type { AppEnv } from "./types"

const app = new Hono<AppEnv>()

app.route("/auth",    authRoutes)
app.route("/session", sessionRoutes)

app.get("/health", (c) => c.json({ status: "ok", service: "auth" }))

const PORT = Number(process.env.PORT) || 3001
serve({ fetch: app.fetch, port: PORT, hostname: "localhost" }, () => {
  console.info(`Auth service running on port ${PORT}`)
})

export default app

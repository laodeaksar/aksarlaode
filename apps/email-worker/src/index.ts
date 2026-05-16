import { emailWorker } from "./processor/email.processor"
import { emailQueue }  from "./queues/email.queue"
import { renderMetrics } from "./lib/metrics"

console.info(JSON.stringify({ event: "worker_started", service: "email-worker" }))

// FIX EML-09: Lightweight HTTP server that exposes:
//   GET /health  — liveness probe (always 200 if process is up)
//   GET /metrics — Prometheus text format for Prometheus/Grafana scraping
//
// Runs on METRICS_PORT (default 9100) so it doesn't conflict with other
// services. Prometheus scrape config example:
//   - job_name: email-worker
//     static_configs:
//       - targets: ['email-worker:9100']
const METRICS_PORT = Number(process.env.METRICS_PORT ?? 9100)

Bun.serve({
  port: METRICS_PORT,
  fetch(req) {
    const { pathname } = new URL(req.url)

    if (pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "email-worker" }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    if (pathname === "/metrics") {
      return new Response(renderMetrics(), {
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
      })
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.info(JSON.stringify({
  event:   "metrics_server_started",
  service: "email-worker",
  port:    METRICS_PORT,
}))

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.info(JSON.stringify({ event: "shutdown", signal, service: "email-worker" }))
  await emailWorker.close()
  await emailQueue.close()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

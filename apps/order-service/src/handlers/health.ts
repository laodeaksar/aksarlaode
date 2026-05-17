import mongoose from "mongoose"

import { env } from "@repo/env/order"

import { redis } from "@/lib/redis"

// ── Types ─────────────────────────────────────────────────────────────────────
type CheckStatus = "ok" | "error"

type CheckResult = {
  status: CheckStatus
  latencyMs: number
  error?: string
}

type HealthResponse = {
  status: "healthy" | "degraded" | "unhealthy"
  service: string
  uptimeSec: number
  checks: {
    mongodb: CheckResult
    redis: CheckResult
    productService: CheckResult
  }
}

// ── Individual dependency checks ──────────────────────────────────────────────

async function checkMongo(): Promise<CheckResult> {
  const start = Date.now()
  try {
    await mongoose.connection.db!.admin().ping()
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (e) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "ping failed",
    }
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const pong = await redis.ping()
    if (pong !== "PONG") throw new Error(`unexpected response: ${pong}`)
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (e) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "ping failed",
    }
  }
}

async function checkProductService(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const res = await fetch(`${env.PRODUCT_SERVICE_URL}/health`, {
      method: "GET",
      headers: { "x-service-token": env.INTERNAL_SERVICE_TOKEN },
      signal: AbortSignal.timeout(3_000), // 3 s hard timeout
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { status: "ok", latencyMs: Date.now() - start }
  } catch (e) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "unreachable",
    }
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function healthHandler({ set }: { set: { status: number } }) {
  // Run all checks concurrently — never let one slow check block the others
  const [mongodb, redis_, productService] = await Promise.all([
    checkMongo(),
    checkRedis(),
    checkProductService(),
  ])

  const checks = { mongodb, redis: redis_, productService }

  const statuses = Object.values(checks).map((c) => c.status)
  const allOk = statuses.every((s) => s === "ok")
  const allFailed = statuses.every((s) => s === "error")
  const overallStatus: HealthResponse["status"] = allOk
    ? "healthy"
    : allFailed
      ? "unhealthy"
      : "degraded"

  // 200 for healthy/degraded (load balancer keeps instance in rotation for degraded)
  // 503 for fully unhealthy (all checks failed — pull from rotation immediately)
  set.status = allFailed ? 503 : 200

  const response: HealthResponse = {
    status: overallStatus,
    service: "order-service",
    uptimeSec: Math.floor(process.uptime()),
    checks,
  }

  return response
}

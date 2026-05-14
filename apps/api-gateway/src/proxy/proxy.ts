import type { Context } from "hono"
import { env }         from "@repo/env/gateway"
import { SERVICE_REGISTRY } from "./service-registry"
import { getBreaker }       from "@/lib/circuit-breaker"
import type { AppEnv }      from "@/types/context"

export async function proxyTo(
  service: keyof typeof SERVICE_REGISTRY,
  c: Context<AppEnv>
): Promise<Response> {
  const { url: baseUrl, prefix } = SERVICE_REGISTRY[service]

  const breaker = getBreaker(service)

  // ── Circuit open — reject immediately, don't touch upstream ──────────────
  if (!breaker.allow()) {
    console.warn(JSON.stringify({
      event:     "circuit_rejected",
      service,
      requestId: c.var.requestId,
    }))
    return c.json(
      {
        error:     "Service temporarily unavailable — please retry shortly",
        code:      "CIRCUIT_OPEN",
        requestId: c.var.requestId,
      },
      503
    ) as unknown as Response
  }

  // ── Build upstream request ────────────────────────────────────────────────
  const strippedPath = c.req.path.replace(prefix, "") || "/"
  const requestUrl   = new URL(c.req.url)
  const targetUrl    = new URL(strippedPath, baseUrl)
  targetUrl.search   = requestUrl.search

  let body: ArrayBuffer | null = null
  if (!["GET", "HEAD"].includes(c.req.method)) {
    body = await c.req.arrayBuffer()
  }

  const upstreamRequest = new Request(targetUrl.toString(), {
    method:  c.req.method,
    headers: buildUpstreamHeaders(c),
    body,
  })

  // Pass the timeout signal so the upstream TCP connection is torn down when
  // requestTimeout middleware fires — not just left open in the background.
  const signal = c.var.abortSignal

  // ── Proxy call ────────────────────────────────────────────────────────────
  try {
    const response = await fetch(upstreamRequest, { signal })

    // 5xx from upstream counts as a circuit failure.
    // 4xx is the client's fault — don't penalise the service for it.
    if (response.status >= 500) {
      breaker.failure()
    } else {
      breaker.success()
    }

    return response
  } catch (e) {
    // Every thrown error (timeout or connection failure) is a circuit failure.
    breaker.failure()

    // Re-throw AbortError — requestTimeout middleware converts it to 504.
    if (e instanceof Error && e.name === "AbortError") throw e

    console.error(JSON.stringify({
      event:     "upstream_error",
      service,
      target:    targetUrl.toString(),
      requestId: c.var.requestId,
      error:     String(e),
    }))

    return c.json(
      { error: "Service unavailable", code: "UPSTREAM_ERROR", requestId: c.var.requestId },
      502
    ) as unknown as Response
  }
}

// ── Header construction ───────────────────────────────────────────────────────
function buildUpstreamHeaders(c: Context<AppEnv>): Headers {
  const headers = new Headers(c.req.raw.headers)

  headers.delete("Authorization")
  headers.delete("Cookie")

  const user = c.var.user
  if (user) {
    headers.set("x-user-id",    user.id)
    headers.set("x-user-role",  user.role)
    headers.set("x-session-id", user.sessionId)
  }

  headers.set("x-request-id",    c.var.requestId)
  headers.set("x-service-token", env.INTERNAL_SERVICE_TOKEN)

  return headers
}

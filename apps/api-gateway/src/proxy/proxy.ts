import type { Context } from "hono"
import { env }         from "@repo/env/gateway"
import { SERVICE_REGISTRY } from "./service-registry"
import type { AppEnv }      from "@/types/context"

export async function proxyTo(
  service: keyof typeof SERVICE_REGISTRY,
  c: Context<AppEnv>
): Promise<Response> {
  const { url: baseUrl, prefix } = SERVICE_REGISTRY[service]

  // Strip the gateway-side prefix and preserve the rest of the path.
  // e.g. GET /products/123?color=red  →  http://product-service:3002/123?color=red
  const strippedPath = c.req.path.replace(prefix, "") || "/"
  const requestUrl   = new URL(c.req.url)
  const targetUrl    = new URL(strippedPath, baseUrl)
  targetUrl.search   = requestUrl.search   // forward query params as-is

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

  try {
    return await fetch(upstreamRequest, { signal })
  } catch (e) {
    // Re-throw AbortError so requestTimeout middleware can return 504.
    // Any other error (ECONNREFUSED, DNS failure, etc.) becomes 502.
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

  // Strip external-facing headers — never forward raw auth to internal services
  headers.delete("Authorization")
  headers.delete("Cookie")

  // Inject validated user context — internal services trust these headers
  const user = c.var.user
  if (user) {
    headers.set("x-user-id",    user.id)
    headers.set("x-user-role",  user.role)
    headers.set("x-session-id", user.sessionId)
  }

  // Propagate request tracing and service authentication
  headers.set("x-request-id",    c.var.requestId)
  headers.set("x-service-token", env.INTERNAL_SERVICE_TOKEN)

  return headers
}

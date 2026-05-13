import { Effect } from "effect"
import type { Context } from "hono"
import { SERVICE_REGISTRY } from "./service-registry"
import { env } from "@repo/env"
import type { AppEnv } from "@/types/context"

export async function proxyTo(
  service: keyof typeof SERVICE_REGISTRY,
  c: Context<AppEnv>
) {
  const baseUrl = SERVICE_REGISTRY[service]
  const url     = `${baseUrl}${c.req.path.replace(`/${service.toLowerCase()}`, "")}`

  const upstreamRequest = new Request(url, {
    method:  c.req.method,
    headers: buildUpstreamHeaders(c),
    body:    ["GET", "HEAD"].includes(c.req.method) ? null : await c.req.arrayBuffer(),
  })

  const program = Effect.tryPromise({
    try:   () => fetch(upstreamRequest),
    catch: (e) => ({ type: "UPSTREAM_ERROR" as const, cause: e }),
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    return c.json(
      { error: "Service unavailable", code: "UPSTREAM_ERROR", requestId: c.var.requestId },
      502
    )
  }

  return result.value // pass upstream response directly
}

function buildUpstreamHeaders(c: Context<AppEnv>): Headers {
  const headers = new Headers(c.req.raw.headers)

  // Strip external-facing headers
  headers.delete("Authorization")
  headers.delete("Cookie")

  // Inject internal context
  const user = c.var.user
  if (user) {
    headers.set("x-user-id",      user.id)
    headers.set("x-user-role",    user.role)
    headers.set("x-session-id",   user.sessionId)
  }

  headers.set("x-request-id",    c.var.requestId)
  headers.set("x-service-token", env.INTERNAL_SERVICE_TOKEN)

  return headers
}

import { Effect }              from "effect"
import type { MiddlewareHandler } from "hono"
import type { AppEnv }          from "@/types/context"
import { PUBLIC_ROUTES, WEBHOOK_ROUTES } from "@/lib/route-permissions"
import { verifyJwt }  from "@/lib/jwt"
import { verifyHmac } from "@/lib/hmac"

export const authResolver: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path   = c.req.path
  const method = c.req.method

  // ── 1. Public routes — pass straight through ──────────────────────────────
  if (isPublic(path, method)) {
    c.set("authPayload", null)
    return next()
  }

  // ── 2. Webhook routes — HMAC signature only ───────────────────────────────
  if (isWebhook(path)) {
    const body      = await c.req.text()
    const signature = c.req.header("x-midtrans-signature") ?? ""

    const verified = await Effect.runPromiseExit(verifyHmac(body, signature))

    if (verified._tag === "Failure") {
      return c.json(
        { error: "Invalid webhook signature", code: "UNAUTHORIZED", requestId: c.var.requestId },
        401
      )
    }

    c.set("authPayload", { type: "webhook" })
    return next()
  }

  // ── 3. Protected routes — Bearer JWT ─────────────────────────────────────
  const authHeader = c.req.header("Authorization")
  const token      = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) {
    return c.json(
      { error: "Missing or malformed Authorization header", code: "UNAUTHORIZED", requestId: c.var.requestId },
      401
    )
  }

  const result = await Effect.runPromiseExit(verifyJwt(token))

  if (result._tag === "Failure") {
    // Distinguish between expired (token was valid but stale) and invalid (bad sig / malformed)
    const tag  = (result.cause.error as { _tag?: string })?._tag ?? ""
    const code = tag === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED"
    return c.json(
      { error: "Invalid or expired token", code, requestId: c.var.requestId },
      401
    )
  }

  // result.value is already a typed User ({ id, role, sessionId })
  c.set("authPayload", result.value)

  // ── Session denylist check (recommended for production) ───────────────────
  // To enforce immediate revocation after logout/session-revoke, call:
  //
  //   const { sessionId } = result.value as { sessionId: string }
  //   const res = await fetch(
  //     `${env.AUTH_SERVICE_URL}/session/internal/${sessionId}/valid`,
  //     { headers: { "x-service-token": env.INTERNAL_SERVICE_TOKEN } }
  //   )
  //   if (!res.ok) {
  //     return c.json({ error: "Session revoked", code: "UNAUTHORIZED" }, 401)
  //   }
  //
  // This adds ~5–10 ms per request. The circuit breaker on the auth-service
  // route handles downtime gracefully. Enable once Redis is confirmed shared
  // between auth-service and the gateway's deployment environment.
  // ─────────────────────────────────────────────────────────────────────────

  await next()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPublic(path: string, method: string): boolean {
  return PUBLIC_ROUTES.some(
    r => r.path === path && (r.method === method || r.method === "*")
  )
}

function isWebhook(path: string): boolean {
  return WEBHOOK_ROUTES.some(r => path.startsWith(r))
}

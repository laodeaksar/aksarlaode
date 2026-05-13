import { Effect } from "effect"
import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "@/types/context"
import { PUBLIC_ROUTES, WEBHOOK_ROUTES } from "@/lib/route-permissions"
import { verifyJwt }  from "@/lib/jwt"
import { verifyHmac } from "@/lib/hmac"

export const authResolver: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path   = c.req.path
  const method = c.req.method

  // ── 1. Public routes — pass straight through ───────────
  if (isPublic(path, method)) {
    c.set("authPayload", null)
    return next()
  }

  // ── 2. Webhook routes — HMAC signature only ────────────
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

  // ── 3. Protected routes — JWT ──────────────────────────
  const authHeader = c.req.header("Authorization")
  const token      = authHeader?.replace("Bearer ", "")

  if (!token) {
    return c.json(
      { error: "Missing token", code: "UNAUTHORIZED", requestId: c.var.requestId },
      401
    )
  }

  const result = await Effect.runPromiseExit(verifyJwt(token))

  if (result._tag === "Failure") {
    const code = result.cause.error === "TOKEN_EXPIRED" ? "TOKEN_EXPIRED" : "UNAUTHORIZED"
    return c.json(
      { error: "Invalid token", code, requestId: c.var.requestId },
      401
    )
  }

  c.set("authPayload", result.value)
  await next()
}

function isPublic(path: string, method: string) {
  return PUBLIC_ROUTES.some(r => r.path === path && (r.method === method || r.method === "*"))
}

function isWebhook(path: string) {
  return WEBHOOK_ROUTES.some(r => path.startsWith(r))
}

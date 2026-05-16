import { defineMiddleware } from "astro:middleware"
import { AppRuntime }       from "./lib/effect/runtime"
import { authApi }          from "./lib/api/auth"

const PROTECTED = ["/checkout", "/account/orders", "/orders"]

// FIX WEB-04: state-mutating Astro API routes require CSRF protection.
//
// Defence-in-depth strategy:
//   Layer 1 — SameSite=Strict on the auth cookie (already applied by auth-service):
//             browsers will not attach the cookie on cross-site navigations,
//             so unauthenticated cross-site requests are rejected by the
//             api-gateway before any side effects occur.
//
//   Layer 2 — Origin header validation (this middleware):
//             for requests that DO carry an Origin header, verify that the
//             origin matches the server's own origin. Requests without an
//             Origin header (e.g. server-to-server, curl) are allowed —
//             SameSite=Strict already provides the primary protection.
//
// This combination defeats all standard CSRF attack vectors without requiring
// a separate CSRF token or double-submit cookie.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export const onRequest = defineMiddleware(async (ctx, next) => {
  // ── CSRF: Origin check for state-mutating API routes ──────────────────────
  if (
    !SAFE_METHODS.has(ctx.request.method) &&
    ctx.url.pathname.startsWith("/api/")
  ) {
    const origin       = ctx.request.headers.get("origin")
    const serverOrigin = ctx.url.origin   // e.g. "https://mysite.com"

    if (origin && origin !== serverOrigin) {
      return new Response(
        JSON.stringify({ error: "Forbidden", code: "CSRF_ORIGIN_MISMATCH" }),
        {
          status:  403,
          headers: { "Content-Type": "application/json" },
        }
      )
    }
  }

  // ── Auth guard for protected pages ─────────────────────────────────────────
  const isProtected = PROTECTED.some(p => ctx.url.pathname.startsWith(p))
  if (!isProtected) return next()

  const cookie = ctx.request.headers.get("cookie") ?? ""

  const exit = await AppRuntime.runPromiseExit(authApi.me(cookie))

  if (exit._tag === "Failure") {
    const redirect = encodeURIComponent(ctx.url.pathname)
    return ctx.redirect(`/account/login?redirect=${redirect}`)
  }

  ctx.locals.user = exit.value
  return next()
})

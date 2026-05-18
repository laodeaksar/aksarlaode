import { defineMiddleware } from "astro:middleware";

import { authApi } from "./lib/api/auth";
import { AppRuntime } from "./lib/effect/runtime";

const PROTECTED = ["/checkout", "/account/orders", "/orders"];

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
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// FIX WEB-07: Content Security Policy and security response headers.
//
// Applied to every page/API response so that even if a future page introduces
// an inline script or loads a resource from an unknown origin, the browser will
// block it before execution.
//
// Header breakdown:
//   default-src 'self'          — baseline: only load resources from this origin
//   script-src  'self' midtrans — Snap.js is loaded from Midtrans CDN
//   style-src   'self' 'unsafe-inline' — Tailwind generates runtime inline styles
//   img-src     'self' data: https:    — product images may come from any CDN
//   connect-src 'self' midtrans        — Snap makes XHR calls to Midtrans API
//   frame-src   midtrans               — Snap opens in an iframe
//   font-src    'self' data:           — local webfonts + base64-embedded fonts
//   object-src  'none'                 — block <object>/<embed> (XSS vector)
//   base-uri    'self'                 — prevent base tag hijacking
//   form-action 'self'                 — prevent form phishing to external URLs
const MIDTRANS_APP =
  "https://app.midtrans.com https://app.sandbox.midtrans.com";
const MIDTRANS_API =
  "https://api.midtrans.com https://api.sandbox.midtrans.com";

const CSP = [
  "default-src 'self'",
  `script-src 'self' ${MIDTRANS_APP}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  `connect-src 'self' ${MIDTRANS_API}`,
  `frame-src ${MIDTRANS_APP}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function applySecurityHeaders(response: Response): Response {
  // Clone headers to avoid mutating a frozen Headers object on some runtimes.
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CSP);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  // ── CSRF: Origin check for state-mutating API routes ──────────────────────
  if (
    !SAFE_METHODS.has(ctx.request.method) &&
    ctx.url.pathname.startsWith("/api/")
  ) {
    const origin = ctx.request.headers.get("origin");
    const serverOrigin = ctx.url.origin; // e.g. "https://mysite.com"

    if (origin && origin !== serverOrigin) {
      return new Response(
        JSON.stringify({ error: "Forbidden", code: "CSRF_ORIGIN_MISMATCH" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Content-Security-Policy": CSP,
            "X-Content-Type-Options": "nosniff",
          },
        }
      );
    }
  }

  // ── Auth guard for protected pages ─────────────────────────────────────────
  const isProtected = PROTECTED.some((p) => ctx.url.pathname.startsWith(p));
  if (!isProtected) {
    const response = await next();
    return applySecurityHeaders(response);
  }

  const cookie = ctx.request.headers.get("cookie") ?? "";

  const exit = await AppRuntime.runPromiseExit(authApi.me(cookie));

  if (exit._tag === "Failure") {
    const redirect = encodeURIComponent(ctx.url.pathname);
    return ctx.redirect(`/account/login?redirect=${redirect}`);
  }

  ctx.locals.user = exit.value;
  const response = await next();
  return applySecurityHeaders(response);
});

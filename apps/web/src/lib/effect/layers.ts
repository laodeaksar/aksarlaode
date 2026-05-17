import { Context, Layer } from "effect"

// ── ApiConfig service ──────────────────────────────────────
export class ApiConfig extends Context.Tag("ApiConfig")<
  ApiConfig,
  { baseUrl: string; timeout: number }
>() {}

// FIX WEB-06: Use a server-only internal URL when available so the private
// gateway address is never bundled into client-side JavaScript.
//
// Priority order:
//   1. INTERNAL_API_URL — no PUBLIC_ prefix, server-only, points to the
//      internal/private gateway address (e.g. http://api-gateway:3000).
//      Set this in production to avoid routing SSR requests through the
//      public internet and to prevent topology leakage in error messages.
//   2. PUBLIC_API_URL — public-facing gateway URL, used as fallback for
//      local development where an internal URL is not configured.
//
// Client-side JS never calls apiFetch directly — it calls Astro API routes
// (e.g. POST /api/payment/initiate) which proxy to the gateway server-side.
// Relative /api/* paths are used in client components, so PUBLIC_API_URL
// is never referenced in browser bundles.
const serverBaseUrl: string =
  (import.meta.env["INTERNAL_API_URL"] as string | undefined) ??
  (import.meta.env["PUBLIC_API_URL"] as string | undefined) ??
  "http://localhost:3000"

export const ApiConfigLayer = Layer.succeed(ApiConfig, {
  baseUrl: serverBaseUrl,
  timeout: 10_000,
})

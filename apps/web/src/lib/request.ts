/**
 * Extract the Cookie header from a Request for forwarding to the API gateway.
 *
 * Used in every Astro page and API route that calls the api-gateway with a
 * server-side fetch — Node.js has no cookie jar, so the browser session cookie
 * must be forwarded explicitly via the Cookie header.
 *
 * Centralised here so future pages cannot accidentally omit the forwarding
 * (which would cause a silent 401 from the gateway).
 *
 * Usage in .astro pages:
 *   import { getCookieHeader } from "@/lib/request"
 *   const cookie = getCookieHeader(Astro.request)
 *
 * Usage in API routes:
 *   import { getCookieHeader } from "@/lib/request"
 *   const cookie = getCookieHeader(request)
 */
export function getCookieHeader(request: Request): string {
  return request.headers.get("cookie") ?? ""
}

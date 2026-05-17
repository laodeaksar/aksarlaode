/**
 * Pure avatar URL validation — no environment or service dependencies.
 *
 * This module is the single source of truth for the avatar domain allowlist
 * and blocklist rules.  It is consumed by:
 *
 *   1. packages/common/src/schemas/index.ts  — Zod schema for HTTP request
 *      validation across all services that accept profile updates.
 *   2. apps/auth-service/src/lib/avatar.ts   — wraps this with the app's own
 *      WEB_URL / ADMIN_URL origins so self-hosted CDN URLs are also accepted.
 *
 * Accepting arbitrary URLs for avatarUrl creates two attack surfaces:
 *  — SSRF: a crafted URL could reach internal services when the server fetches
 *    the image for resizing / proxying.
 *  — Open redirect / content injection via a malicious image host.
 *
 * Validation order (first failing check wins):
 *  1. Must parse as a valid URL.
 *  2. Scheme must be https.
 *  3. Hostname must NOT be in BLOCKED_HOSTNAMES and must NOT be a raw IP.
 *  4. Hostname must be in STATIC_ALLOWED_HOSTS or in extraHosts.
 */

// ── Allowlist ─────────────────────────────────────────────────────────────────

export const STATIC_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  // ── Avatar / identity services ───────────────────────────────────────────
  "gravatar.com",
  "www.gravatar.com",
  "ui-avatars.com",
  "api.dicebear.com",
  // ── Common cloud image CDNs ──────────────────────────────────────────────
  "res.cloudinary.com",
  "images.unsplash.com",
  "cdn.jsdelivr.net",
  // ── Social / OAuth provider avatars ─────────────────────────────────────
  "lh3.googleusercontent.com", // Google OAuth profile pictures
  "avatars.githubusercontent.com", // GitHub profile pictures
])

/** Human-readable comma-separated list — used in validation error messages. */
export const ALLOWED_AVATAR_HOSTS: string = [...STATIC_ALLOWED_HOSTS].join(", ")

// ── Blocklist (runs before allowlist) ─────────────────────────────────────────

/** Hostnames that must never be accepted regardless of the allowlist. */
const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS / GCP / Azure instance metadata
  "metadata.google.internal",
])

/**
 * Returns true if the hostname looks like a raw IPv4 address (e.g. 192.168.1.1)
 * or a raw IPv6 address (e.g. 2001:db8::1 after bracket-stripping by the URL
 * parser).  Raw IPs bypass DNS-based allowlisting and can address RFC-1918 /
 * loopback ranges.
 */
function isRawIpAddress(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true
  if (/^[\da-f:]+$/i.test(hostname) && hostname.includes(":")) return true
  return false
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if `raw` is safe to store as an avatar URL.
 *
 * @param raw        - The URL string to validate.
 * @param extraHosts - Optional additional hostnames to accept beyond the static
 *                     allowlist (e.g. the application's own CDN origin).
 *                     Blocked hostnames are still rejected even if present here.
 */
export function isAllowedAvatarUrl(
  raw: string,
  extraHosts: ReadonlySet<string> = new Set()
): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol !== "https:") return false

  const host = url.hostname.toLowerCase()

  // Blocklist check — always takes priority
  if (BLOCKED_HOSTNAMES.has(host)) return false
  if (isRawIpAddress(host)) return false

  // Allowlist check
  return STATIC_ALLOWED_HOSTS.has(host) || extraHosts.has(host)
}

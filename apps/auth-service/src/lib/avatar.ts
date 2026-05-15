import { env } from "@repo/env/auth"

/**
 * Domain allowlist for avatar URLs.
 *
 * Accepting arbitrary URLs for avatarUrl opens two attack surfaces:
 *  — SSRF: a crafted URL could reach internal services (metadata endpoints,
 *    Redis, Postgres) when the server fetches the image for resizing/proxying.
 *  — Open redirect / content injection: a malicious image served from an
 *    attacker-controlled host can be used for phishing or CSP bypass.
 *
 * Validation order (first failing check wins):
 *  1. Must be HTTPS.
 *  2. Hostname must NOT be in the explicit blocklist (loopback, link-local,
 *     private ranges, cloud metadata endpoints, bare IP addresses).
 *  3. Hostname MUST appear in STATIC_ALLOWED_HOSTS or the app's own origins.
 *
 * The blocklist runs *before* the allowlist so that even if someone sets
 * WEB_URL=http://localhost:3000 in development, localhost can never be
 * submitted as an avatar URL.
 */

// ── 1. Allowlist ──────────────────────────────────────────────────────────────

const STATIC_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  // ── Avatar / identity services ─────────────────────────────────────────
  "gravatar.com",
  "www.gravatar.com",
  "ui-avatars.com",
  "api.dicebear.com",
  // ── Common cloud image CDNs ────────────────────────────────────────────
  "res.cloudinary.com",
  "images.unsplash.com",
  "cdn.jsdelivr.net",
  // ── Social / OAuth provider avatars ───────────────────────────────────
  "lh3.googleusercontent.com",      // Google OAuth profile pictures
  "avatars.githubusercontent.com",  // GitHub profile pictures
])

/**
 * Extracts hostnames from the configured app URLs so avatars served from the
 * same origin (or its CDN) are accepted without editing code.
 *
 * Note: localhost is explicitly blocked below even if it appears here, so
 * development WEB_URL values cannot be used to sneak localhost through.
 */
function appAllowedHosts(): ReadonlySet<string> {
  const hosts = new Set<string>()
  for (const raw of [env.WEB_URL, env.ADMIN_URL]) {
    try {
      hosts.add(new URL(raw).hostname.toLowerCase())
    } catch {
      // ignore — misconfigured URLs are caught at startup by parseEnv()
    }
  }
  return hosts
}

// ── 2. Blocklist (takes priority over allowlist) ──────────────────────────────

/** Hostnames that must never be accepted regardless of the allowlist. */
const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254",         // AWS / GCP / Azure instance metadata
  "metadata.google.internal",
])

/**
 * Returns true if the hostname looks like a raw IPv4 address (e.g. 192.168.1.1)
 * or a raw IPv6 address (e.g. [::1]).  Raw IPs are never safe because they
 * bypass DNS-based allowlisting and can address RFC-1918 / loopback ranges.
 */
function isRawIpAddress(hostname: string): boolean {
  // IPv4: four dot-separated 1–3-digit groups
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true
  // IPv6: surrounded by brackets in URLs (URL parser strips brackets)
  if (/^[\da-f:]+$/i.test(hostname) && hostname.includes(":")) return true
  return false
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if `raw` is safe to store as an avatar URL:
 *  — scheme is https
 *  — hostname is not in the explicit blocklist and is not a raw IP
 *  — hostname is in STATIC_ALLOWED_HOSTS or the application's own origins
 */
export function isAllowedAvatarUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol !== "https:") return false

  const host = url.hostname.toLowerCase()

  // Blocklist check — always runs first
  if (BLOCKED_HOSTNAMES.has(host)) return false
  if (isRawIpAddress(host))        return false

  // Allowlist check
  return STATIC_ALLOWED_HOSTS.has(host) || appAllowedHosts().has(host)
}

/**
 * Human-readable list of allowed hostnames — used in validation error messages.
 */
export const ALLOWED_AVATAR_HOSTS: string =
  [...STATIC_ALLOWED_HOSTS].join(", ")

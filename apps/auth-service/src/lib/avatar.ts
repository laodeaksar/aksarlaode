import {
  ALLOWED_AVATAR_HOSTS,
  isAllowedAvatarUrl as coreIsAllowedAvatarUrl,
} from "@repo/common/lib/avatar"
import { env } from "@repo/env/auth"

export { ALLOWED_AVATAR_HOSTS }

/**
 * Auth-service avatar URL validator.
 *
 * Extends the core allowlist in @repo/common/lib/avatar with the application's
 * own WEB_URL / ADMIN_URL origins so that avatars uploaded to the app's own
 * CDN are accepted without listing the domain in the shared package.
 *
 * The blocklist (localhost, raw IPs, cloud metadata endpoints) always takes
 * priority — even if WEB_URL is set to http://localhost:3000 in development,
 * localhost is still blocked.
 */
export function isAllowedAvatarUrl(raw: string): boolean {
  return coreIsAllowedAvatarUrl(raw, appAllowedHosts())
}

/**
 * Extracts the hostnames from the configured app origins.
 * Called on each validation so it always reflects the current env value;
 * in practice env is static after startup so the cost is negligible.
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

/**
 * better-auth — DISABLED
 *
 * This library was evaluated but not adopted.
 *
 * REASON: Importing and initializing better-auth at startup creates a
 * parallel session system that conflicts with the service's custom EdDSA JWT
 * implementation. It also runs its own Drizzle schema migrations, producing
 * ghost tables (`user`, `session`, `account`, `verification`) alongside the
 * service's own `users` and `sessions` tables, causing confusion in DB audits
 * and backups.
 *
 * The cookie prefix (`advanced.cookiePrefix: "ec"`) was also identical to the
 * custom `ec_refresh` cookie, which would cause silent cookie shadowing if
 * the handler were ever registered.
 *
 * If OAuth2/OIDC (Google, GitHub, etc.) social login is needed in the future:
 *   1. Evaluate better-auth as the SOLE auth layer, not alongside this custom one
 *   2. Or implement PKCE + token exchange manually in a new oauth.handler.ts
 *
 * The `better-auth` package has been removed from package.json.
 * See: security audit finding F-03
 */

export {}; // keep as a module to avoid import errors in any stale references

/**
 * @repo/env — environment variable validation
 *
 * Import the scoped env for your service instead of this barrel:
 *
 *   auth-service   →  import { env } from "@repo/env/auth"
 *   @repo/database →  import { env } from "@repo/env/database"
 *   api-gateway    →  import { env } from "@repo/env/gateway"
 *
 * The scoped imports only validate the variables your service actually needs,
 * so a missing Midtrans key will not crash the auth-service at startup.
 */

export { env as authEnv }    from "./auth"
export { env as dbEnv }      from "./database"
export { env as gatewayEnv } from "./gateway"

export type { AuthEnv }    from "./auth"
export type { DatabaseEnv } from "./database"
export type { GatewayEnv } from "./gateway"

/**
 * @repo/env — environment variable validation
 *
 * Import the scoped env for your service instead of this barrel:
 *
 *   auth-service     →  import { env } from "@repo/env/auth"
 *   product-service  →  import { env } from "@repo/env/product"
 *   order-service    →  import { env } from "@repo/env/order"
 *   payment-service  →  import { env } from "@repo/env/payment"
 *   email-worker     →  import { env } from "@repo/env/email-worker"
 *   @repo/database   →  import { env } from "@repo/env/database"
 *   api-gateway      →  import { env } from "@repo/env/gateway"
 *   admin            →  import { env } from "@repo/env/admin"
 *
 * Redis URL helper:
 *   BullMQ / IORedis  →  import { parseRedisUrl } from "@repo/env/utils"
 *
 * The scoped imports validate only the variables your service actually needs,
 * so a missing Midtrans key will not crash the auth-service at startup.
 */

export { env as authEnv } from "./auth";
export { env as dbEnv } from "./database";
export { env as gatewayEnv } from "./gateway";
export { env as productEnv } from "./product";
export { env as orderEnv } from "./order";
export { env as adminEnv } from "./admin";
export { env as emailWorkerEnv } from "./email-worker";
export { env as paymentEnv } from "./payment";

export { parseRedisUrl } from "./utils";

export type { AuthEnv } from "./auth";
export type { DatabaseEnv } from "./database";
export type { GatewayEnv } from "./gateway";
export type { ProductEnv } from "./product";
export type { OrderEnv } from "./order";
export type { AdminEnv } from "./admin";
export type { EmailWorkerEnv } from "./email-worker";
export type { PaymentEnv } from "./payment";

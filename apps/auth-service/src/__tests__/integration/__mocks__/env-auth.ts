/**
 * Integration-test env for auth-service.
 *
 * Differences from the unit-test mock:
 *  - DATABASE_URL reads from the real process.env so integration tests hit
 *    the live dev Postgres instance.
 *  - Ed25519 keypairs are still generated fresh so every test run uses
 *    isolated, ephemeral signing keys with no production value.
 */
import { generateKeyPairSync } from "node:crypto"

function makeKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519")
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    publicKey:  publicKey.export({ type: "spki",  format: "der" }).toString("base64"),
  }
}

const access  = makeKeypair()
const refresh = makeKeypair()

export const env = {
  NODE_ENV:                "test" as const,
  DATABASE_URL:            process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/ecommerce",
  JWT_ACCESS_PRIVATE_KEY:  access.privateKey,
  JWT_ACCESS_PUBLIC_KEY:   access.publicKey,
  JWT_REFRESH_PRIVATE_KEY: refresh.privateKey,
  JWT_REFRESH_PUBLIC_KEY:  refresh.publicKey,
  INTERNAL_SERVICE_TOKEN:  "test-internal-service-token-minimum-32chars!!",
  REDIS_HOST:              "localhost",
  REDIS_PORT:              6379,
  REDIS_PASSWORD:          "",
  WEB_URL:                 "http://localhost:3000",
  ADMIN_URL:               "http://localhost:3001",
}

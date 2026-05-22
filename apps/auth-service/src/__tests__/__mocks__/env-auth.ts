import { generateKeyPairSync } from "node:crypto";

/**
 * Generates a fresh Ed25519 keypair for each test run.
 * Uses Node.js synchronous crypto — no async setup required.
 * The keys are ephemeral and have no production value.
 */
function makeKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey: privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
    publicKey: publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64"),
  };
}

const access = makeKeypair();
const refresh = makeKeypair();

export const env = {
  NODE_ENV: "test" as const,
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_PRIVATE_KEY: access.privateKey,
  JWT_ACCESS_PUBLIC_KEY: access.publicKey,
  JWT_REFRESH_PRIVATE_KEY: refresh.privateKey,
  JWT_REFRESH_PUBLIC_KEY: refresh.publicKey,
  INTERNAL_SERVICE_TOKEN: "test-internal-service-token-minimum-32chars!!",
  REDIS_URL: "redis://localhost:6379",
  WEB_URL: "http://localhost:3000",
  ADMIN_URL: "http://localhost:3001",
};

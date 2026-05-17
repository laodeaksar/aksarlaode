/**
 * Generates Ed25519 keypairs for JWT signing and prints the base64-encoded
 * values ready to paste into your .env file.
 *
 * Usage:
 *   pnpm tsx scripts/generate-keypairs.ts
 *
 * Output format:
 *   Private key → PKCS8 DER → base64  (auth-service only — keep secret)
 *   Public key  → SPKI  DER → base64  (auth-service + api-gateway)
 *
 * Run this once per environment (dev, staging, production) and store the
 * values in your secrets manager / CI environment.  Never commit them to git.
 */

import { generateKeyPairSync } from "node:crypto"

function generate(label: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519")

  const priv = privateKey
    .export({ type: "pkcs8", format: "der" })
    .toString("base64")
  const pub = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64")

  console.log(`# ── ${label} ──`)
  console.log(`JWT_${label}_PRIVATE_KEY=${priv}`)
  console.log(`JWT_${label}_PUBLIC_KEY=${pub}`)
  console.log()
}

console.log("# Ed25519 keypairs — generated", new Date().toISOString())
console.log("# Copy these values into your .env file.")
console.log("# PRIVATE keys must only be set on auth-service.")
console.log("# PUBLIC keys are safe to share with api-gateway.")
console.log()

generate("ACCESS")
generate("REFRESH")

console.log("# ── API Gateway (copy only PUBLIC keys) ──")
console.log("# JWT_ACCESS_PUBLIC_KEY=<same value as above>")

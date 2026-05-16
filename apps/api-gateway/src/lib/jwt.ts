import { Effect, Data } from "effect"
import { env }          from "@repo/env/gateway"
import type { User }    from "@/types/context"

// ── Error types ───────────────────────────────────────────────────────────────
class TokenExpiredError   extends Data.TaggedError("TokenExpiredError") {}
class TokenInvalidError   extends Data.TaggedError("TokenInvalidError")<{ reason: string }> {}
class TokenMalformedError extends Data.TaggedError("TokenMalformedError") {}

export type JwtError = TokenExpiredError | TokenInvalidError | TokenMalformedError

// ── Verify ────────────────────────────────────────────────────────────────────
/**
 * Verifies an EdDSA (Ed25519) access token using the public key only.
 *
 * The gateway never holds the private key — a compromised gateway cannot forge
 * tokens.  Returns a fully-typed User so callers never touch raw payload fields.
 */
export const verifyJwt = (
  token: string
): Effect.Effect<User, JwtError> =>
  Effect.gen(function* () {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return yield* Effect.fail(new TokenMalformedError())
    }

    // 1. Validate alg header
    const headerObj = yield* Effect.try({
      try:   () => JSON.parse(atob(parts[0]!.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>,
      catch: () => new TokenMalformedError(),
    })

    if (headerObj["alg"] !== "EdDSA") {
      return yield* Effect.fail(new TokenInvalidError({ reason: "unexpected_algorithm" }))
    }

    // 2. Import Ed25519 public key and verify signature
    const key = yield* Effect.tryPromise({
      try:   () => importPublicKey(env.JWT_ACCESS_PUBLIC_KEY),
      catch: () => new TokenInvalidError({ reason: "key_import_failed" }),
    })

    const valid = yield* Effect.tryPromise({
      try:   () => verifySignature(parts, key),
      catch: () => new TokenInvalidError({ reason: "verify_failed" }),
    })

    if (!valid) {
      return yield* Effect.fail(new TokenInvalidError({ reason: "bad_signature" }))
    }

    // 3. Decode payload
    const payload = yield* Effect.try({
      try:   () => decodePayload(parts[1]!),
      catch: () => new TokenMalformedError(),
    })

    // 4. Check expiry
    if (Date.now() / 1000 > payload.exp) {
      return yield* Effect.fail(new TokenExpiredError())
    }

    // 5. Validate required claims
    if (!payload.sub || !payload.role || !payload.sessionId) {
      return yield* Effect.fail(new TokenInvalidError({ reason: "missing_claims" }))
    }

    return {
      id:        payload.sub,
      role:      payload.role,
      sessionId: payload.sessionId,
      ...(payload.email ? { email: payload.email } : {}),
    } satisfies User
  })

// ── WebCrypto helpers ─────────────────────────────────────────────────────────
type JwtPayload = {
  sub:       string
  role:      User["role"]
  sessionId: string
  email?:    string   // added in AUTH-04; optional for backwards compat with old tokens
  iat:       number
  exp:       number
}

function decodePayload(b64: string): JwtPayload {
  return JSON.parse(
    atob(b64.replace(/-/g, "+").replace(/_/g, "/"))
  ) as JwtPayload
}

async function importPublicKey(b64: string): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "Ed25519" },
    false,
    ["verify"]
  )
}

async function verifySignature(parts: string[], key: CryptoKey): Promise<boolean> {
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const sig  = Uint8Array.from(
    atob(parts[2]!.replace(/-/g, "+").replace(/_/g, "/")),
    c => c.charCodeAt(0)
  )
  return crypto.subtle.verify("Ed25519", key, sig, data)
}

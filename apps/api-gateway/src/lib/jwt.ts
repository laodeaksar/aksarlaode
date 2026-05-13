import { Effect, Data } from "effect"
import { env } from "@repo/env"
import type { User } from "../types/context"

// ── Error types ────────────────────────────────────────────
class TokenExpiredError extends Data.TaggedError("TokenExpiredError") {}
class TokenInvalidError extends Data.TaggedError("TokenInvalidError")<{
  reason: string
}> {}
class TokenMalformedError extends Data.TaggedError("TokenMalformedError") {}

export type JwtError = TokenExpiredError | TokenInvalidError | TokenMalformedError

// ── Verify ─────────────────────────────────────────────────
export const verifyJwt = (
  token: string
): Effect.Effect<User, JwtError> =>
  Effect.gen(function* () {
    // 1. Split and decode structure
    const parts = token.split(".")
    if (parts.length !== 3) {
      return yield* Effect.fail(new TokenMalformedError())
    }

    // 2. Verify signature via WebCrypto (CF Workers compatible)
    const key = yield* Effect.tryPromise({
      try: () => importJwtKey(env.JWT_SECRET),
      catch: () => new TokenInvalidError({ reason: "key_import_failed" }),
    })

    const valid = yield* Effect.tryPromise({
      try: () => verifySignature(token, key),
      catch: () => new TokenInvalidError({ reason: "signature_verify_failed" }),
    })

    if (!valid) {
      return yield* Effect.fail(new TokenInvalidError({ reason: "bad_signature" }))
    }

    // 3. Decode payload
    const payload = yield* Effect.try({
      try:   () => JSON.parse(atob(parts[1]!)) as JwtPayload,
      catch: () => new TokenMalformedError(),
    })

    // 4. Check expiry
    if (Date.now() / 1000 > payload.exp) {
      return yield* Effect.fail(new TokenExpiredError())
    }

    // 5. Validate shape
    if (!payload.sub || !payload.role || !payload.sessionId) {
      return yield* Effect.fail(new TokenInvalidError({ reason: "missing_claims" }))
    }

    return {
      id:        payload.sub,
      role:      payload.role,
      sessionId: payload.sessionId,
    } satisfies User
  })

// ── Sign (used in tests / token issuance) ─────────────────
export const signJwt = (
  user: User,
  expiresInSeconds = 900  // 15 min
): Effect.Effect<string, TokenInvalidError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await importJwtKey(env.JWT_SECRET, ["sign"])
      const now = Math.floor(Date.now() / 1000)

      const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      const payload = b64url(JSON.stringify({
        sub:       user.id,
        role:      user.role,
        sessionId: user.sessionId,
        iat:       now,
        exp:       now + expiresInSeconds,
      }))

      const data      = `${header}.${payload}`
      const signature = await crypto.subtle.sign("HMAC", key, enc(data))

      return `${data}.${b64url(signature)}`
    },
    catch: (e) => new TokenInvalidError({ reason: String(e) }),
  })

// ── WebCrypto helpers ──────────────────────────────────────
type JwtPayload = {
  sub:       string
  role:      User["role"]
  sessionId: string
  iat:       number
  exp:       number
}

const enc = (s: string) => new TextEncoder().encode(s)
const b64url = (input: string | ArrayBuffer) =>
  btoa(typeof input === "string" ? input : String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

async function importJwtKey(
  secret: string,
  usages: KeyUsage[] = ["verify"]
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  )
}

async function verifySignature(token: string, key: CryptoKey): Promise<boolean> {
  const parts     = token.split(".")
  const data      = enc(`${parts[0]}.${parts[1]}`)
  const signature = Uint8Array.from(atob(parts[2]!.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0))

  return crypto.subtle.verify("HMAC", key, signature, data)
}

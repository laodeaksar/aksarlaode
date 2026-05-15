import { Effect, Data } from "effect"
import { env }          from "@repo/env/gateway"
import type { User }    from "@/types/context"

// ── Error types ───────────────────────────────────────────────────────────────
class TokenExpiredError   extends Data.TaggedError("TokenExpiredError") {}
class TokenInvalidError   extends Data.TaggedError("TokenInvalidError")<{ reason: string }> {}
class TokenMalformedError extends Data.TaggedError("TokenMalformedError") {}

export type JwtError = TokenExpiredError | TokenInvalidError | TokenMalformedError

// ── Verify ────────────────────────────────────────────────────────────────────
// Returns a fully-typed User so callers never touch raw payload fields.
export const verifyJwt = (
  token: string
): Effect.Effect<User, JwtError> =>
  Effect.gen(function* () {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return yield* Effect.fail(new TokenMalformedError())
    }

    // 1. Import HMAC key and verify signature via WebCrypto
    const key = yield* Effect.tryPromise({
      try:   () => importKey(env.JWT_ACCESS_SECRET, ["verify"]),
      catch: () => new TokenInvalidError({ reason: "key_import_failed" }),
    })

    const valid = yield* Effect.tryPromise({
      try:   () => verifySignature(parts, key),
      catch: () => new TokenInvalidError({ reason: "verify_failed" }),
    })

    if (!valid) {
      return yield* Effect.fail(new TokenInvalidError({ reason: "bad_signature" }))
    }

    // 2. Decode payload
    const payload = yield* Effect.try({
      try:   () => decodePayload(parts[1]!),
      catch: () => new TokenMalformedError(),
    })

    // 3. Check expiry
    if (Date.now() / 1000 > payload.exp) {
      return yield* Effect.fail(new TokenExpiredError())
    }

    // 4. Validate required claims
    if (!payload.sub || !payload.role || !payload.sessionId) {
      return yield* Effect.fail(new TokenInvalidError({ reason: "missing_claims" }))
    }

    return {
      id:        payload.sub,
      role:      payload.role,
      sessionId: payload.sessionId,
    } satisfies User
  })

// ── Sign (only needed in tests / token re-issuance) ──────────────────────────
export const signJwt = (
  user: User,
  expiresInSeconds = 900  // 15 min default
): Effect.Effect<string, TokenInvalidError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await importKey(env.JWT_ACCESS_SECRET, ["sign"])
      const now = Math.floor(Date.now() / 1000)

      const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      const body    = b64url(JSON.stringify({
        sub:       user.id,
        role:      user.role,
        sessionId: user.sessionId,
        iat:       now,
        exp:       now + expiresInSeconds,
      }))

      const data      = `${header}.${body}`
      const signature = await crypto.subtle.sign("HMAC", key, enc(data))

      return `${data}.${b64url(signature)}`
    },
    catch: (e) => new TokenInvalidError({ reason: String(e) }),
  })

// ── WebCrypto helpers ─────────────────────────────────────────────────────────
type JwtPayload = {
  sub:       string
  role:      User["role"]
  sessionId: string
  iat:       number
  exp:       number
}

const enc    = (s: string) => new TextEncoder().encode(s)
const b64url = (input: string | ArrayBuffer) =>
  btoa(typeof input === "string" ? input : String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

function decodePayload(b64: string): JwtPayload {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/")
  return JSON.parse(atob(normalized)) as JwtPayload
}

async function importKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  )
}

async function verifySignature(parts: string[], key: CryptoKey): Promise<boolean> {
  const data = enc(`${parts[0]}.${parts[1]}`)
  const sig  = Uint8Array.from(
    atob(parts[2]!.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  )
  return crypto.subtle.verify("HMAC", key, sig, data)
}

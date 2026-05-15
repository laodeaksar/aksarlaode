import { Effect, Data } from "effect"
import { env }          from "@repo/env/auth"

class TokenError extends Data.TaggedError("TokenError")<{ reason: string }> {}

export type TokenPair = { accessToken: string; refreshToken: string }

/**
 * Issues an access token (signed with JWT_ACCESS_SECRET, 15 min) and a
 * refresh token (signed with JWT_REFRESH_SECRET, 7 days).
 *
 * Both tokens carry a `type` claim ("access" / "refresh") so that
 * verifyToken can enforce the correct secret per type and reject
 * cross-type usage even if both secrets were somehow identical.
 */
export const issueTokenPair = (
  userId:    string,
  role:      string,
  sessionId: string
): Effect.Effect<TokenPair, TokenError> =>
  Effect.gen(function* () {
    const accessToken  = yield* signToken(
      { sub: userId, role, sessionId, type: "access" },
      60 * 15,
      env.JWT_ACCESS_SECRET
    )
    const refreshToken = yield* signToken(
      { sub: userId, type: "refresh" },
      60 * 60 * 24 * 7,
      env.JWT_REFRESH_SECRET
    )
    return { accessToken, refreshToken }
  })

/**
 * Verifies a JWT and returns its payload.
 *
 * The `expectedType` parameter selects the correct HMAC secret and asserts
 * that the token's `type` claim matches — preventing a 7-day refresh token
 * from being accepted in place of a 15-minute access token.
 */
export const verifyToken = (
  token:        string,
  expectedType: "access" | "refresh"
): Effect.Effect<Record<string, unknown>, TokenError> =>
  Effect.tryPromise({
    try: async () => {
      const parts = token.split(".")
      if (parts.length !== 3) throw new Error("Invalid token format")
      const [header, body, sig] = parts as [string, string, string]
      const data = `${header}.${body}`

      const secret = expectedType === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      )

      const sigBytes = Uint8Array.from(
        atob(sig.replace(/-/g, "+").replace(/_/g, "/")),
        (ch) => ch.charCodeAt(0)
      )

      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        sigBytes,
        new TextEncoder().encode(data)
      )
      if (!valid) throw new Error("Invalid signature")

      const payload = JSON.parse(
        atob(body.replace(/-/g, "+").replace(/_/g, "/"))
      ) as Record<string, unknown>

      if (typeof payload.exp !== "number") {
        throw new Error("Token missing expiry claim")
      }
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        throw new Error("Token expired")
      }

      if (payload["type"] !== expectedType) {
        throw new Error(
          `Token type mismatch: expected "${expectedType}" but got "${String(payload["type"] ?? "unknown")}"`
        )
      }

      return payload
    },
    catch: (e) => new TokenError({ reason: String(e) }),
  })

const signToken = (
  claims:           Record<string, unknown>,
  expiresInSeconds: number,
  secret:           string
): Effect.Effect<string, TokenError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      )
      const now     = Math.floor(Date.now() / 1000)
      const payload = { ...claims, iat: now, exp: now + expiresInSeconds }
      const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      const body    = b64url(JSON.stringify(payload))
      const dataStr = `${header}.${body}`
      const sigBuf  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataStr))
      return `${dataStr}.${b64url(sigBuf)}`
    },
    catch: (e) => new TokenError({ reason: String(e) }),
  })

const b64url = (input: string | ArrayBuffer) =>
  btoa(typeof input === "string" ? input : String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

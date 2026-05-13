import { Effect, Data } from "effect"
import { env }          from "@repo/env/auth"

class TokenError extends Data.TaggedError("TokenError")<{ reason: string }> {}

export type TokenPair = { accessToken: string; refreshToken: string }

export const issueTokenPair = (
  userId:    string,
  role:      string,
  sessionId: string
): Effect.Effect<TokenPair, TokenError> =>
  Effect.gen(function* () {
    const accessToken  = yield* signToken({ sub: userId, role, sessionId }, 60 * 15)
    const refreshToken = yield* signToken({ sub: userId, type: "refresh"  }, 60 * 60 * 24 * 7)
    return { accessToken, refreshToken }
  })

export const verifyToken = (
  token: string
): Effect.Effect<Record<string, unknown>, TokenError> =>
  Effect.tryPromise({
    try: async () => {
      const parts = token.split(".")
      if (parts.length !== 3) throw new Error("Invalid token format")
      const [header, body, sig] = parts as [string, string, string]
      const data = `${header}.${body}`

      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(env.JWT_SECRET),
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

      const now = Math.floor(Date.now() / 1000)
      if (typeof payload.exp === "number" && payload.exp < now) {
        throw new Error("Token expired")
      }

      return payload
    },
    catch: (e) => new TokenError({ reason: String(e) }),
  })

const signToken = (
  claims:           Record<string, unknown>,
  expiresInSeconds: number
): Effect.Effect<string, TokenError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(env.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      )
      const now     = Math.floor(Date.now() / 1000)
      const payload = { ...claims, iat: now, exp: now + expiresInSeconds }
      const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      const body    = b64url(JSON.stringify(payload))
      const data    = `${header}.${body}`
      const sig     = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
      return `${data}.${b64url(sig)}`
    },
    catch: (e) => new TokenError({ reason: String(e) }),
  })

const b64url = (input: string | ArrayBuffer) =>
  btoa(typeof input === "string" ? input : String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

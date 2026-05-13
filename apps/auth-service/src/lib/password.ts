import { Effect, Data } from "effect"

class HashError   extends Data.TaggedError("HashError")   {}
class VerifyError extends Data.TaggedError("VerifyError") {}

// Uses WebCrypto PBKDF2 — works on CF Workers + Node
export const hashPassword = (
  plain: string
): Effect.Effect<string, HashError> =>
  Effect.tryPromise({
    try: async () => {
      const salt  = crypto.getRandomValues(new Uint8Array(16))
      const key   = await deriveKey(plain, salt)
      const hash  = await crypto.subtle.exportKey("raw", key)

      // store as "salt:hash" both hex-encoded
      return `${hex(salt)}:${hex(new Uint8Array(hash))}`
    },
    catch: () => new HashError(),
  })

export const verifyPassword = (
  plain:  string,
  stored: string
): Effect.Effect<boolean, VerifyError> =>
  Effect.tryPromise({
    try: async () => {
      const [saltHex, hashHex] = stored.split(":")
      if (!saltHex || !hashHex) return false

      const salt      = unhex(saltHex)
      const key       = await deriveKey(plain, salt)
      const candidate = new Uint8Array(await crypto.subtle.exportKey("raw", key))

      return constantTimeEqual(hex(candidate), hashHex)
    },
    catch: () => new VerifyError(),
  })

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  )
}

const hex   = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2,"0")).join("")
const unhex = (s: string)     => new Uint8Array(s.match(/.{2}/g)!.map(h => parseInt(h,16)))

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

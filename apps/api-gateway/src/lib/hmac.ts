import { Effect, Data } from "effect"
import { env }          from "@repo/env/gateway"

// ── Error types ───────────────────────────────────────────────────────────────
class HmacInvalidError extends Data.TaggedError("HmacInvalidError")<{ reason: string }> {}
class HmacMissingError extends Data.TaggedError("HmacMissingError") {}

export type HmacError = HmacInvalidError | HmacMissingError

// ── Midtrans signature format:
//    SHA512( orderId + statusCode + grossAmount + serverKey )
export const verifyHmac = (
  rawBody:   string,
  signature: string
): Effect.Effect<void, HmacError> =>
  Effect.gen(function* () {
    if (!signature) {
      return yield* Effect.fail(new HmacMissingError())
    }

    // 1. Parse body to extract Midtrans fields
    const body = yield* Effect.try({
      try:   () => JSON.parse(rawBody) as MidtransPayload,
      catch: () => new HmacInvalidError({ reason: "body_parse_failed" }),
    })

    // 2. Build the expected signature string
    const signatureInput = `${body.order_id}${body.status_code}${body.gross_amount}${env.MIDTRANS_SERVER_KEY}`

    // 3. Hash with SHA-512 via WebCrypto
    const expected = yield* Effect.tryPromise({
      try:   () => sha512hex(signatureInput),
      catch: () => new HmacInvalidError({ reason: "hash_failed" }),
    })

    // 4. Constant-time comparison — prevents timing attacks
    if (!constantTimeEqual(expected, signature)) {
      return yield* Effect.fail(new HmacInvalidError({ reason: "signature_mismatch" }))
    }
  })

// ── Helpers ───────────────────────────────────────────────────────────────────
type MidtransPayload = {
  order_id:     string
  status_code:  string
  gross_amount: string
  [key: string]: unknown
}

async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

// XOR every character — prevents early exit timing leak
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

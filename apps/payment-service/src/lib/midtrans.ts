import { Effect, Data } from "effect"
import { env }          from "@repo/env"

class MidtransError extends Data.TaggedError("MidtransError")<{
  code:    number
  message: string
}> {}

export type SnapToken = {
  token:       string
  redirectUrl: string
}

export type MidtransNotification = {
  order_id:           string
  transaction_status: string
  fraud_status:       string
  payment_type:       string
  gross_amount:       string
  status_code:        string
}

const BASE_URL = env.MIDTRANS_IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1"
  : "https://app.sandbox.midtrans.com/snap/v1"

// FIX PAY-01: authHeader is kept as a private function — its return value
// (the base64-encoded server key) is only ever used directly in the fetch
// headers map and is NEVER stored, logged, or included in error messages.
// The redactMidtransError helper below strips any accidental leakage.
const authHeader = (): string =>
  `Basic ${btoa(env.MIDTRANS_SERVER_KEY + ":")}`

/**
 * Strips any Authorization header value that may have leaked into an error
 * message (e.g. via a custom HTTP client, a serialized request object, or
 * a middleware that captures raw headers on error).
 *
 * Pattern: "Basic " followed by one or more base64 characters.
 */
function redactAuthFromMessage(msg: string): string {
  return msg.replace(/Basic\s+[A-Za-z0-9+/=]{8,}/g, "Basic [REDACTED]")
}

function toMidtransError(e: unknown): MidtransError {
  const raw = e as any
  const code = typeof raw?.code === "number" ? raw.code : 500

  // Sanitize the message before storing in the error object.  Do NOT log
  // the raw error directly — use console.error(err.message) on the
  // MidtransError object instead, which will already be redacted.
  const rawMsg  = typeof raw?.message === "string" ? raw.message : "Midtrans request failed"
  const safeMsg = redactAuthFromMessage(rawMsg)

  return new MidtransError({ code, message: safeMsg })
}

// ── Create Snap transaction ───────────────────────────────
export const createSnapTransaction = (params: {
  orderId:       string
  amount:        number
  customerName:  string
  customerEmail: string
  items:         Array<{ id: string; name: string; price: number; quantity: number }>
}): Effect.Effect<SnapToken, MidtransError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/transactions`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          // authHeader() is called inline — value never assigned to a variable
          // that could be captured by a closure or serialised into a log.
          "Authorization": authHeader(),
        },
        body: JSON.stringify({
          transaction_details: {
            order_id:     params.orderId,
            gross_amount: params.amount,
          },
          customer_details: {
            first_name: params.customerName,
            email:      params.customerEmail,
          },
          item_details: params.items.map(i => ({
            id:       i.id,
            name:     i.name,
            price:    i.price,
            quantity: i.quantity,
          })),
          expiry: {
            unit:     "minutes",
            duration: 60,
          },
        }),
      })

      if (!res.ok) {
        // FIX PAY-01: only capture status_code and status_message from the
        // Midtrans JSON body — never log res.headers or the request context.
        const errBody = await res.json() as { status_code?: number; status_message?: string }
        throw { code: errBody.status_code ?? res.status, message: errBody.status_message ?? res.statusText }
      }

      const data = await res.json() as { token: string; redirect_url: string }
      return { token: data.token, redirectUrl: data.redirect_url }
    },
    // FIX PAY-01: route ALL errors through toMidtransError() which redacts
    // any Authorization header value before it reaches an error object that
    // could be logged by upstream callers.
    catch: toMidtransError,
  })

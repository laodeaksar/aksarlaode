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

const authHeader = () =>
  `Basic ${btoa(env.MIDTRANS_SERVER_KEY + ":")}`

// ── Create Snap transaction ───────────────────────────────
export const createSnapTransaction = (params: {
  orderId:     string
  amount:      number
  customerName: string
  customerEmail: string
  items:       Array<{ id: string; name: string; price: number; quantity: number }>
}): Effect.Effect<SnapToken, MidtransError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${BASE_URL}/transactions`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
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
        const err = await res.json() as { status_code: number; status_message: string }
        throw { code: err.status_code, message: err.status_message }
      }

      const data = await res.json() as { token: string; redirect_url: string }
      return { token: data.token, redirectUrl: data.redirect_url }
    },
    catch: (e: any) => new MidtransError({ code: e.code ?? 500, message: e.message ?? "Unknown" }),
  })

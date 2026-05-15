import type { APIRoute } from "astro"
import { AppRuntime }    from "@/lib/effect/runtime"
import { apiFetch }      from "@/lib/api/client"
import { NetworkError }  from "@/lib/effect/errors"

// FIX W-01: CheckoutForm.tsx was calling fetch("/api/payment/initiate") which
// had no matching route in the Astro app — every checkout produced an orphaned
// order (stock reserved, status PENDING_PAYMENT, but Snap token never created).
//
// This thin server-side proxy:
//   1. Forwards the authenticated cookie to the api-gateway
//   2. Uses the server-side apiFetch helper (Effect-based, with timeout)
//   3. Never exposes the api-gateway URL to the browser bundle
//   4. Returns the same { snapToken, redirectUrl, paymentId } shape

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie") ?? ""

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!body.orderId || typeof body.orderId !== "string") {
    return new Response(
      JSON.stringify({ error: "orderId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const exit = await AppRuntime.runPromiseExit(
    apiFetch<{ snapToken: string; redirectUrl: string; paymentId: string }>(
      "/payments/initiate",
      {
        method: "POST",
        body:   JSON.stringify(body),
        cookie,
      }
    )
  )

  if (exit._tag === "Failure") {
    const err = exit.cause.error as { status?: number; message?: string }
    const status  = err?.status ?? 500
    const message = err?.message ?? "Payment initiation failed"

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json" } }
    )
  }

  return new Response(
    JSON.stringify(exit.value),
    { status: 201, headers: { "Content-Type": "application/json" } }
  )
}

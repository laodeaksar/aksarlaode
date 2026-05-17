import type { APIRoute } from "astro"

import { apiFetch } from "@/lib/api/client"
import type { ApiError } from "@/lib/effect/errors"
import { AppRuntime } from "@/lib/effect/runtime"

// FIX W-01: CheckoutForm.tsx was calling fetch("/api/payment/initiate") which
// had no matching route in the Astro app — every checkout produced an orphaned
// order (stock reserved, status PENDING_PAYMENT, but Snap token never created).
//
// This thin server-side proxy:
//   1. Forwards the authenticated cookie to the api-gateway
//   2. Uses the server-side apiFetch helper (Effect-based, with timeout)
//   3. Never exposes the api-gateway URL to the browser bundle
//   4. Returns the same { snapToken, redirectUrl, paymentId } shape

// FIX WEB-05: Map typed upstream errors to safe browser-facing messages.
// Never forward raw error internals (ECONNREFUSED URLs, stack traces, internal
// service paths) — only the gateway-controlled HttpError message is forwarded.
function sanitizeUpstreamError(err: unknown): {
  status: number
  message: string
} {
  const e = err as Partial<ApiError>
  switch (e._tag) {
    case "AuthError":
      return { status: 401, message: "Authentication required" }
    case "NotFoundError":
      // Do NOT forward e.resource — it contains the internal gateway path
      return { status: 404, message: "Payment resource not found" }
    case "HttpError":
      // message comes from upstream gateway's b.error field — controlled content
      return { status: e.status ?? 502, message: e.message ?? "Upstream error" }
    case "NetworkError":
      // e.message is String(fetchError) and may contain internal URLs/addresses
      return { status: 503, message: "Payment service temporarily unavailable" }
    case "ParseError":
      // e.message is String(jsonParseError) — internal detail, replace it
      return { status: 502, message: "Upstream returned an invalid response" }
    default:
      return { status: 500, message: "Payment initiation failed" }
  }
}

export const POST: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie") ?? ""

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!body.orderId || typeof body.orderId !== "string") {
    return new Response(JSON.stringify({ error: "orderId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const exit = await AppRuntime.runPromiseExit(
    apiFetch<{ snapToken: string; redirectUrl: string; paymentId: string }>(
      "/payments/initiate",
      {
        method: "POST",
        body: JSON.stringify(body),
        cookie,
      }
    )
  )

  if (exit._tag === "Failure") {
    const { status, message } = sanitizeUpstreamError(exit.cause.error)
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify(exit.value), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  })
}

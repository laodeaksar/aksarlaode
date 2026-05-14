import Elysia from "elysia"

/**
 * Per-request structured logging plugin.
 *
 * Emits one JSON log line per request on *completion* instead of on arrival,
 * so every log entry contains the final HTTP status code and end-to-end
 * response latency.
 *
 * Fields emitted:
 *   event      — "request_completed" | "request_error"
 *   method     — HTTP verb
 *   path       — pathname only (query string deliberately omitted to avoid
 *                accidentally logging sensitive filter params)
 *   status     — final HTTP status code
 *   latencyMs  — wall-clock ms from derive() to onAfterHandle / onError
 *   requestId  — x-request-id header (set by API gateway)
 *   userId     — x-user-id header (absent on public endpoints)
 *   userRole   — x-user-role header (absent on public endpoints)
 *   errorCode  — Elysia error code (only on request_error events)
 */

function emit(
  event:     "request_completed" | "request_error",
  method:    string,
  path:      string,
  status:    number,
  latencyMs: number,
  headers:   Record<string, string | undefined>,
  extra?:    Record<string, unknown>,
) {
  console.info(JSON.stringify({
    event,
    method,
    path,
    status,
    latencyMs,
    requestId: headers["x-request-id"] ?? null,
    userId:    headers["x-user-id"]    ?? null,
    userRole:  headers["x-user-role"]  ?? null,
    ...extra,
  }))
}

export const requestLogger = new Elysia({ name: "request-logger" })

  // Attach startTime to each request's context — runs once per request,
  // before any handler or guard, so it captures the full processing time.
  .derive({ as: "global" }, () => ({ _startTime: Date.now() }))

  // ── Success path — fires after handler returns, before response is sent ────
  .onAfterHandle({ as: "global" }, ({ request, headers, set, _startTime }) => {
    const path = new URL(request.url).pathname
    emit(
      "request_completed",
      request.method,
      path,
      (set.status as number | undefined) ?? 200,
      Date.now() - _startTime,
      headers as Record<string, string | undefined>,
    )
  })

  // ── Error path — fires when a handler throws or Elysia raises a built-in error
  // _startTime may be undefined if the error occurred before derive() ran
  // (e.g. during body parsing). Fall back to 0 latency in that case.
  .onError({ as: "global" }, ({ request, headers, set, code, _startTime }) => {
    const path      = new URL(request.url).pathname
    const startTime = (_startTime as number | undefined) ?? Date.now()
    const status    = (set.status as number | undefined)
      ?? (code === "NOT_FOUND"       ? 404
        : code === "VALIDATION"      ? 422
        : code === "PARSE"           ? 400
        : code === "INVALID_COOKIE"  ? 400
        : 500)

    emit(
      "request_error",
      request.method,
      path,
      status,
      Date.now() - startTime,
      headers as Record<string, string | undefined>,
      { errorCode: code },
    )
  })

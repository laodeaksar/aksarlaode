import Elysia from "elysia"

/**
 * Per-request structured logging + automatic x-request-id generation.
 *
 * Behaviours:
 *  1. If the incoming request carries an x-request-id header it is reused as-is.
 *     This lets the API gateway inject a trace ID that flows end-to-end.
 *  2. If no x-request-id is present a UUID v4 is generated for this request.
 *     The generated ID is echoed back in the response x-request-id header so
 *     clients can correlate logs without needing gateway support.
 *  3. One JSON log line is emitted on *completion* (not on arrival) so every
 *     entry contains the final HTTP status code and end-to-end latency.
 *
 * Log fields:
 *   event      — "request_completed" | "request_error"
 *   method     — HTTP verb
 *   path       — pathname only (query string omitted — may contain sensitive params)
 *   status     — final HTTP status code
 *   latencyMs  — wall-clock ms from derive() to onAfterHandle / onError
 *   requestId  — x-request-id (original or auto-generated)
 *   userId     — x-user-id header  (null on public endpoints)
 *   userRole   — x-user-role header (null on public endpoints)
 *   errorCode  — Elysia error code  (only on request_error events)
 */

function emit(
  event:     "request_completed" | "request_error",
  method:    string,
  path:      string,
  status:    number,
  latencyMs: number,
  requestId: string,
  userId:    string | null,
  userRole:  string | null,
  extra?:    Record<string, unknown>,
) {
  console.info(JSON.stringify({
    event,
    method,
    path,
    status,
    latencyMs,
    requestId,
    userId,
    userRole,
    ...extra,
  }))
}

export const requestLogger = new Elysia({ name: "request-logger" })

  // ── Derive per-request context ─────────────────────────────────────────────
  // Runs once per request, before any handler or guard.
  // Generates a requestId if the caller did not supply one.
  .derive({ as: "global" }, ({ headers }) => ({
    _startTime: Date.now(),
    requestId:  (headers["x-request-id"] as string | undefined)
                  ?? crypto.randomUUID(),
  }))

  // ── Success path ───────────────────────────────────────────────────────────
  // Fires after the handler returns, before the response is sent to the client.
  .onAfterHandle({ as: "global" }, ({ request, headers, set, _startTime, requestId }) => {
    // Echo the request ID back so clients can correlate without gateway support
    set.headers["x-request-id"] = requestId

    emit(
      "request_completed",
      request.method,
      new URL(request.url).pathname,
      (set.status as number | undefined) ?? 200,
      Date.now() - _startTime,
      requestId,
      (headers["x-user-id"]   as string | undefined) ?? null,
      (headers["x-user-role"] as string | undefined) ?? null,
    )
  })

  // ── Error path ─────────────────────────────────────────────────────────────
  // _startTime / requestId may be undefined if the error occurred before
  // derive() ran (e.g. body parse failure on a malformed Content-Type).
  // Fall back gracefully so we never swallow a log line.
  .onError({ as: "global" }, ({ request, headers, set, code, _startTime, requestId }) => {
    const id        = (requestId as string  | undefined) ?? crypto.randomUUID()
    const startTime = (_startTime as number | undefined) ?? Date.now()

    // Echo request ID even on error responses
    set.headers["x-request-id"] = id

    const status = (set.status as number | undefined)
      ?? (code === "NOT_FOUND"      ? 404
        : code === "VALIDATION"     ? 422
        : code === "PARSE"          ? 400
        : code === "INVALID_COOKIE" ? 400
        : 500)

    emit(
      "request_error",
      request.method,
      new URL(request.url).pathname,
      status,
      Date.now() - startTime,
      id,
      (headers["x-user-id"]   as string | undefined) ?? null,
      (headers["x-user-role"] as string | undefined) ?? null,
      { errorCode: code },
    )
  })

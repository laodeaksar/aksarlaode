import type { MiddlewareHandler } from "hono"

import type { AppEnv } from "@/types/context"

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000 // 24 h — matches Stripe / Braintree standard

// UUID v4 only — rejects arbitrary strings that could be used as cache-poisoning vectors
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── In-memory store ───────────────────────────────────────────────────────────
// For multi-instance deployments, replace with an Upstash Redis SET/GET/EXPIRE
// call using the same scoped key and the same status/response fields.
type RecordStatus = "processing" | "complete"

interface CachedResponse {
  status: number
  body: string
  contentType: string
}

interface IdempotencyRecord {
  status: RecordStatus
  response?: CachedResponse
  expiresAt: number
}

const store = new Map<string, IdempotencyRecord>()

// Evict expired entries every 10 minutes to prevent unbounded memory growth
setInterval(
  () => {
    const now = Date.now()
    for (const [k, r] of store) {
      if (now > r.expiresAt) store.delete(k)
    }
  },
  10 * 60 * 1000
)

// ── Key scoping ───────────────────────────────────────────────────────────────
// Scope by authenticated user ID so that two different users cannot share or
// hijack each other's cached responses. Fall back to client IP for public
// routes where no user identity is available yet.
function scopedKey(key: string, userId: string | null, ip: string): string {
  return `${userId ?? ip}:${key}`
}

// ── Middleware ────────────────────────────────────────────────────────────────
// Idempotency is opt-in: clients that don't send the header pass through
// unchanged. Only POST requests are deduplicated — PUT is inherently idempotent
// and GET / DELETE need no protection.
export const idempotency: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "POST") return next()

  const rawKey = c.req.header("idempotency-key")
  if (!rawKey) return next()

  // ── Validate key format ───────────────────────────────────────────────────
  if (!UUID_V4_RE.test(rawKey)) {
    return c.json(
      {
        error: "Idempotency-Key must be a valid UUID v4",
        code: "INVALID_IDEMPOTENCY_KEY",
        requestId: c.var.requestId,
      },
      400
    )
  }

  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  const key = scopedKey(rawKey, c.var.user?.id ?? null, ip)
  const now = Date.now()

  const existing = store.get(key)

  if (existing && now <= existing.expiresAt) {
    // ── Duplicate request while original is still in flight ───────────────
    if (existing.status === "processing") {
      return c.json(
        {
          error:
            "A request with this Idempotency-Key is already being processed",
          code: "IDEMPOTENCY_CONFLICT",
          requestId: c.var.requestId,
        },
        409
      )
    }

    // ── Replay the cached response ────────────────────────────────────────
    if (existing.status === "complete" && existing.response) {
      const cached = existing.response
      console.info(
        JSON.stringify({
          event: "idempotency_replay",
          requestId: c.var.requestId,
          key: rawKey,
          status: cached.status,
        })
      )
      return new Response(cached.body, {
        status: cached.status,
        headers: {
          "Content-Type": cached.contentType,
          "Idempotency-Replayed": "true",
          "X-Request-Id": c.var.requestId,
        },
      })
    }
  }

  // ── First time seeing this key — mark as processing ───────────────────────
  store.set(key, { status: "processing", expiresAt: now + TTL_MS })

  await next()

  // ── Cache the response — but only for non-5xx results ────────────────────
  // 5xx responses are transient failures; the client should retry and we must
  // not lock them out by caching the error. 4xx responses ARE cached so the
  // client sees a consistent "your request was bad" reply on replay.
  const res = c.res
  if (res.status < 500) {
    try {
      const body = await res.clone().text()
      const contentType = res.headers.get("content-type") ?? "application/json"
      store.set(key, {
        status: "complete",
        response: { status: res.status, body, contentType },
        expiresAt: now + TTL_MS,
      })
    } catch {
      // If we can't read the response (e.g., streaming), fall through.
      // The record stays as "processing" and will expire naturally.
    }
  } else {
    // 5xx — remove the lock so the client can retry with the same key
    store.delete(key)
  }
}

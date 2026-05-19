import type { Context, MiddlewareHandler } from "hono";

import { getClientIp } from "@/lib/client-ip";
import { getRedis } from "@/lib/redis";
import type { AppEnv } from "@/types/context";

// ── Constants ─────────────────────────────────────────────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h — matches Stripe / Braintree standard
const TTL_SEC = Math.ceil(TTL_MS / 1000);

// UUID v4 only — rejects arbitrary strings that could be used as cache-poisoning vectors
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Types ─────────────────────────────────────────────────────────────────────
type RecordStatus = "processing" | "complete";

interface CachedResponse {
  status: number;
  body: string;
  contentType: string;
}

interface IdempotencyRecord {
  status: RecordStatus;
  response?: CachedResponse;
}

// ── In-memory fallback store ──────────────────────────────────────────────────
// C-11: Primary store is Redis (shared across all gateway instances and survives
// restarts). This fallback keeps the gateway functional during Redis outages at
// the cost of reverting to per-instance deduplication only — cross-instance
// duplicate protection is lost until Redis recovers.
interface FallbackRecord extends IdempotencyRecord {
  expiresAt: number;
}

const fallbackStore = new Map<string, FallbackRecord>();

// Evict expired entries every 10 minutes to prevent unbounded memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [k, r] of fallbackStore) {
      if (now > r.expiresAt) fallbackStore.delete(k);
    }
  },
  10 * 60 * 1000
);

// ── Redis store helpers ───────────────────────────────────────────────────────
// All helpers throw on Redis error — callers catch and fall back to in-memory.

async function redisGet(key: string): Promise<IdempotencyRecord | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as IdempotencyRecord;
}

// Atomic set-if-not-exists with TTL.
// Returns "OK" if the key was newly created (lock acquired), null if it already existed.
async function redisAcquire(key: string): Promise<boolean> {
  const payload = JSON.stringify({ status: "processing" } satisfies IdempotencyRecord);
  const result = await getRedis().set(key, payload, "EX", TTL_SEC, "NX");
  return result === "OK";
}

async function redisSetComplete(key: string, record: IdempotencyRecord): Promise<void> {
  await getRedis().set(key, JSON.stringify(record), "EX", TTL_SEC);
}

async function redisDel(key: string): Promise<void> {
  await getRedis().del(key);
}

// ── Key scoping ───────────────────────────────────────────────────────────────
// Scope by authenticated user ID so that two different users cannot share or
// hijack each other's cached responses. Fall back to client IP for public
// routes where no user identity is available yet.
function scopedKey(key: string, userId: string | null, ip: string): string {
  return `idempotency:${userId ?? ip}:${key}`;
}

// ── Shared response helpers ───────────────────────────────────────────────────
function replayResponse(
  cached: CachedResponse,
  requestId: string,
  rawKey: string
): Response {
  console.info(
    JSON.stringify({
      event: "idempotency_replay",
      requestId,
      key: rawKey,
      status: cached.status,
    })
  );
  return new Response(cached.body, {
    status: cached.status,
    headers: {
      "Content-Type": cached.contentType,
      "Idempotency-Replayed": "true",
      "X-Request-Id": requestId,
    },
  });
}

async function buildCompleteRecord(c: Context<AppEnv>): Promise<IdempotencyRecord | null> {
  const res = c.res;
  if (res.status >= 500) return null; // 5xx — do not cache transient failures

  try {
    const body = await res.clone().text();
    const contentType = res.headers.get("content-type") ?? "application/json";
    return {
      status: "complete",
      response: { status: res.status, body, contentType },
    };
  } catch {
    // Streaming or unreadable body — leave record as "processing", expires naturally
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
// Idempotency is opt-in: clients that don't send the header pass through
// unchanged. Only POST requests are deduplicated — GET / DELETE are inherently
// idempotent and need no protection.
export const idempotency: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "POST") return next();

  const rawKey = c.req.header("idempotency-key");
  if (!rawKey) return next();

  // ── Validate key format ───────────────────────────────────────────────────
  if (!UUID_V4_RE.test(rawKey)) {
    return c.json(
      {
        error: "Idempotency-Key must be a valid UUID v4",
        code: "INVALID_IDEMPOTENCY_KEY",
        requestId: c.var.requestId,
      },
      400
    );
  }

  const ip = getClientIp(c);
  const key = scopedKey(rawKey, c.var.user?.id ?? null, ip);
  const now = Date.now();

  // ── Try Redis path ────────────────────────────────────────────────────────
  let redisAvailable = true;

  try {
    const acquired = await redisAcquire(key);

    if (acquired) {
      // Lock acquired — first time seeing this key, proceed to upstream
      await next();

      const record = await buildCompleteRecord(c);
      if (record) {
        redisSetComplete(key, record).catch(() => {
          /* non-critical: record expires as "processing" and client can retry */
        });
      } else if (c.res.status >= 500) {
        // 5xx — remove lock so client can retry with the same key
        redisDel(key).catch(() => { /* non-critical */ });
      }
      return;
    }

    // Key already exists — inspect existing record
    const existing = await redisGet(key);

    if (existing?.status === "processing") {
      return c.json(
        {
          error: "A request with this Idempotency-Key is already being processed",
          code: "IDEMPOTENCY_CONFLICT",
          requestId: c.var.requestId,
        },
        409
      );
    }

    if (existing?.status === "complete" && existing.response) {
      return replayResponse(existing.response, c.var.requestId, rawKey);
    }

    // Record missing or in unexpected state — proceed as first-time request
    await next();
    const record = await buildCompleteRecord(c);
    if (record) {
      redisSetComplete(key, record).catch(() => { /* non-critical */ });
    }
    return;
  } catch {
    // Redis unavailable — fall through to in-memory path
    redisAvailable = false;
  }

  // ── In-memory fallback path ───────────────────────────────────────────────
  // Cross-instance deduplication is lost here. Single-instance deduplication
  // still works, which is acceptable for a transient Redis outage.
  if (!redisAvailable) {
    const existing = fallbackStore.get(key);

    if (existing && now <= existing.expiresAt) {
      if (existing.status === "processing") {
        return c.json(
          {
            error: "A request with this Idempotency-Key is already being processed",
            code: "IDEMPOTENCY_CONFLICT",
            requestId: c.var.requestId,
          },
          409
        );
      }

      if (existing.status === "complete" && existing.response) {
        return replayResponse(existing.response, c.var.requestId, rawKey);
      }
    }

    fallbackStore.set(key, { status: "processing", expiresAt: now + TTL_MS });

    await next();

    const record = await buildCompleteRecord(c);
    if (record) {
      fallbackStore.set(key, { ...record, expiresAt: now + TTL_MS });
    } else if (c.res.status >= 500) {
      fallbackStore.delete(key);
    }
  }
};

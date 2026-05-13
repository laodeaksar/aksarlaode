import { Effect } from "effect"
import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../types/context"

// sliding window counters stored in Redis (via Cloudflare KV or Upstash)
const BURST_LIMIT     = 20   // per second
const SUSTAINED_LIMIT = 200  // per minute

export const rateLimiter: MiddlewareHandler<AppEnv> = async (c, next) => {
  const ip  = c.req.header("cf-connecting-ip") ?? "unknown"
  const now = Date.now()

  const check = Effect.gen(function* () {
    const perSecond = yield* incrementWindow(ip, "1s", 1_000,  BURST_LIMIT)
    const perMinute = yield* incrementWindow(ip, "1m", 60_000, SUSTAINED_LIMIT)

    if (!perSecond.allowed || !perMinute.allowed) {
      return yield* Effect.fail({ limited: true, retryAfter: perMinute.resetIn })
    }
  })

  const result = await Effect.runPromiseExit(check)

  if (result._tag === "Failure") {
    const { retryAfter } = result.cause.error as { limited: boolean; retryAfter: number }
    return c.json(
      { error: "Too Many Requests", code: "RATE_LIMITED", requestId: c.var.requestId },
      429,
      { "Retry-After": String(Math.ceil(retryAfter / 1000)) }
    )
  }

  await next()
}

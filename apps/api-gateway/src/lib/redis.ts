/**
 * Shared Redis client for the API gateway.
 *
 * Used by the circuit breaker for cross-instance state persistence (GW-02).
 * All operations are fire-and-forget from the gateway's perspective — a Redis
 * outage degrades to in-memory-only behaviour without failing requests.
 */
import Redis      from "ioredis"
import { env }    from "@repo/env/gateway"

let _client: Redis | null = null

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis({
      host:               env.REDIS_HOST,
      port:               env.REDIS_PORT,
      password:           env.REDIS_PASSWORD || undefined,
      lazyConnect:        true,
      enableOfflineQueue: false,    // fail-fast: don't queue commands when disconnected
      maxRetriesPerRequest: 1,      // one retry then give up — circuit breaker is resilient
      commandTimeout:     500,      // 500 ms max per command
    })

    _client.on("error", (err) => {
      console.warn(JSON.stringify({
        event:   "gateway_redis_error",
        message: err.message,
      }))
    })
  }
  return _client
}

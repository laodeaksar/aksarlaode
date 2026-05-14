import Redis from "ioredis"
import { env } from "@repo/env/order"

export const redis = new Redis({
  host:                 env.REDIS_HOST,
  port:                 env.REDIS_PORT,
  password:             env.REDIS_PASSWORD || undefined,
  lazyConnect:          true,
  maxRetriesPerRequest: 3,
  enableReadyCheck:     false,
})

redis.on("error", (err) =>
  console.error(JSON.stringify({ event: "redis_error", error: String(err) }))
)

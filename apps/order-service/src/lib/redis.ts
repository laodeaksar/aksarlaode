import Redis from "ioredis";

import { env } from "@repo/env/order";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

redis.on("error", (err) =>
  console.error(JSON.stringify({ event: "redis_error", error: String(err) }))
);

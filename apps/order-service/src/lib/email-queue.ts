import { Queue } from "bullmq"
import { env }   from "@repo/env/order"

const connection = {
  host:     env.REDIS_HOST,
  port:     env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
}

export const emailQueue = new Queue("email", { connection })

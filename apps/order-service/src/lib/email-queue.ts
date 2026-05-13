import { Queue } from "bullmq"
import { env }   from "@repo/env"

const connection = {
  host:     env.REDIS_HOST,
  port:     env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
}

export const emailQueue = new Queue("email", { connection })

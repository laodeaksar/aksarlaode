import { emailWorker } from "./processor/email.processor"
import { emailQueue }  from "./queues/email.queue"

console.info("📧 Email worker started")

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.info(`Received ${signal}, closing worker...`)
  await emailWorker.close()
  await emailQueue.close()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

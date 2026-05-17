import { Queue } from "bullmq"

import { redis } from "@/lib/redis"

// FIX EML-01: queue name changed from "password-reset" to "email" so this
// producer targets the same queue that email-worker's Worker is listening on.
// Job name "password-reset" matches the HANDLERS map in email.processor.ts.

export type PasswordResetJobData = {
  userId: string
  email: string
  resetLink: string
}

const emailQueue = new Queue("email", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  },
})

export async function enqueuePasswordReset(
  data: PasswordResetJobData
): Promise<void> {
  await emailQueue.add("password-reset", data)
}

import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

export type PasswordResetJobData = {
  to:       string
  resetUrl: string
}

/**
 * BullMQ queue for outbound password-reset emails.
 *
 * Jobs are consumed by apps/email-worker. The same ioredis connection is
 * reused across the auth-service so we don't open extra sockets.
 *
 * Retry policy: 3 attempts with exponential back-off (5s → 25s → 125s).
 * After all retries fail, the job moves to the "failed" set so ops can
 * inspect it. Neither complete nor failed jobs are kept indefinitely to
 * prevent Redis memory growth.
 */
const passwordResetQueue = new Queue("password-reset", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail:     200,
    attempts:         3,
    backoff: { type: "exponential", delay: 5_000 },
  },
})

/**
 * Enqueue a password-reset email.
 *
 * The raw reset token (not the hash) is embedded in `resetUrl` here —
 * it travels only through the Redis job payload, never in an HTTP response.
 */
export async function enqueuePasswordReset(data: PasswordResetJobData): Promise<void> {
  await passwordResetQueue.add("send-password-reset-email", data)
}

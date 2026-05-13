import { Worker, type Job } from "bullmq"
import { env }              from "@repo/env"
import { MailChannelsProvider } from "@/providers/mailchannels.provider"
import { handleOrderConfirmation } from "@/jobs/order-confirmation"
import { handleOrderCancelled }    from "@/jobs/order-cancelled"
import { handleOrderCreated }      from "@/jobs/order-created"
import { handlePasswordReset }     from "@/jobs/password-reset"
import { handleShippingUpdate }    from "@/jobs/shipping-update"
import type { EmailJobType, EmailJobPayload } from "@/queues/email.queue"

const provider = new MailChannelsProvider()

const HANDLERS: {
  [K in EmailJobType]: (
    payload:  EmailJobPayload[K],
    provider: MailChannelsProvider
  ) => Promise<{ success: boolean; error?: string; retryable?: boolean }>
} = {
  "order-created":       handleOrderCreated,
  "order-confirmation":  handleOrderConfirmation,
  "order-cancelled":     handleOrderCancelled,
  "password-reset":      handlePasswordReset,
  "shipping-update":     handleShippingUpdate,
}

export const emailWorker = new Worker(
  "email",
  async (job: Job<EmailJobPayload[EmailJobType]>) => {
    const type    = job.name as EmailJobType
    const handler = HANDLERS[type]

    if (!handler) {
      // Unknown job type — move to DLQ immediately, don't retry
      throw Object.assign(
        new Error(`Unknown job type: ${type}`),
        { retryable: false }
      )
    }

    const result = await handler(job.data as any, provider)

    if (!result.success) {
      const err = Object.assign(
        new Error(result.error ?? "Send failed"),
        { retryable: result.retryable ?? true }
      )
      throw err
    }

    return { sent: true, jobId: job.id, type }
  },
  {
    connection:  { host: env.REDIS_HOST, port: env.REDIS_PORT, password: env.REDIS_PASSWORD },
    concurrency: 5,
    limiter:     { max: 50, duration: 60_000 },   // 50 emails/min
  }
)

// ── Lifecycle hooks ────────────────────────────────────────
emailWorker.on("completed", (job, result) => {
  console.info(JSON.stringify({ event: "email_sent", jobId: job.id, type: result.type }))
})

emailWorker.on("failed", (job, err: any) => {
  console.error(JSON.stringify({
    event:       "email_failed",
    jobId:       job?.id,
    type:        job?.name,
    attempt:     job?.attemptsMade,
    retryable:   err.retryable ?? true,
    error:       err.message,
  }))
})

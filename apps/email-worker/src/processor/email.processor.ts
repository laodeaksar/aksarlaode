import { Worker, type Job } from "bullmq"
import { env }              from "@repo/env"
import { MailChannelsProvider } from "@/providers/mailchannels.provider"
import { handleOrderConfirmation } from "@/jobs/order-confirmation"
import { handleOrderCancelled }    from "@/jobs/order-cancelled"
import { handleOrderCreated }      from "@/jobs/order-created"
import { handlePasswordReset }     from "@/jobs/password-reset"
import { handleShippingUpdate }    from "@/jobs/shipping-update"
import type { EmailJobType, EmailJobPayload } from "@/queues/email.queue"
import { PAYLOAD_SCHEMAS } from "@/lib/payload-schemas"

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

// FIX EML-05: total retry attempts configured here — must match defaultJobOptions
// in email.queue.ts so the "permanently failed" check is accurate.
const MAX_ATTEMPTS = 3

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

    // FIX EML-07: Validate payload shape before dispatching to the handler.
    // A job enqueued with a missing or wrong-type field (e.g. userEmail is a
    // UUID instead of an address) will now fail immediately with a clear
    // ZodError message rather than crashing deep inside the template renderer.
    const schema = PAYLOAD_SCHEMAS[type]
    if (schema) {
      const parsed = schema.safeParse(job.data)
      if (!parsed.success) {
        const message = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ")
        throw Object.assign(
          new Error(`Invalid payload for job type "${type}": ${message}`),
          { retryable: false }
        )
      }
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

// ── Lifecycle hooks ────────────────────────────────────────────────────────────
emailWorker.on("completed", (job, result) => {
  console.info(JSON.stringify({
    event:  "email_sent",
    jobId:  job.id,
    type:   result.type,
  }))
})

emailWorker.on("failed", (job, err: any) => {
  const attempt       = job?.attemptsMade ?? 0
  const isPermanent   = !err.retryable || attempt >= MAX_ATTEMPTS

  // Always log the failure
  console.error(JSON.stringify({
    event:     isPermanent ? "email_permanently_failed" : "email_failed",
    jobId:     job?.id,
    type:      job?.name,
    attempt,
    maxAttempts: MAX_ATTEMPTS,
    retryable: err.retryable ?? true,
    error:     err.message,
    payload:   job?.data ? {
      orderId:   (job.data as any).orderId,
      userEmail: (job.data as any).userEmail ?? (job.data as any).email,
    } : null,
  }))

  // FIX EML-05: emit a distinct CRITICAL log when a job is permanently dead.
  // This structured entry is designed to be picked up by log-based alerting
  // (CloudWatch Metric Filter, Datadog Log Monitor, Loki alert rule, etc.)
  // matching on: event = "email_permanently_failed"
  if (isPermanent) {
    console.error(JSON.stringify({
      event:    "ALERT_EMAIL_DEAD_LETTER",
      severity: "CRITICAL",
      jobId:    job?.id,
      type:     job?.name,
      message:  `Email job permanently failed after ${attempt} attempt(s) — manual intervention required`,
      runbook:  "Check BullMQ dashboard / Redis for job details. Re-queue via admin panel or CLI.",
    }))

    // Optional: fire a webhook alert if ALERT_WEBHOOK_URL is configured.
    // Non-blocking — do not await or crash the worker on webhook failure.
    if (env.ALERT_WEBHOOK_URL) {
      fetch(env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text:    `🚨 Email permanently failed: \`${job?.name}\` (jobId: ${job?.id})`,
          jobId:   job?.id,
          type:    job?.name,
          attempt,
          error:   err.message,
        }),
        signal: AbortSignal.timeout(5_000),
      }).catch(e =>
        console.warn(JSON.stringify({ event: "alert_webhook_failed", error: String(e) }))
      )
    }
  }
})

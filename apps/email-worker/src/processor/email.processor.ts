import { Worker, type Job } from "bullmq";
import * as v from "valibot";

import { env } from "@repo/env/email-worker";
import { parseRedisUrl } from "@repo/env/utils";

import { incrementCounter } from "@/lib/metrics";
import { PAYLOAD_SCHEMAS } from "@/lib/payload-schemas";
import { handleOrderCancelled } from "@/jobs/order-cancelled";
import { handleOrderConfirmation } from "@/jobs/order-confirmation";
import { handleOrderCreated } from "@/jobs/order-created";
import { handlePasswordReset } from "@/jobs/password-reset";
import { handleShippingUpdate } from "@/jobs/shipping-update";
import { handleStaffInvite } from "@/jobs/staff-invite";
import { MailChannelsProvider } from "@/providers/mailchannels.provider";
import type { EmailJobPayload, EmailJobType } from "@/queues/email.queue";

const provider = new MailChannelsProvider();

const HANDLERS: {
  [K in EmailJobType]: (
    payload: EmailJobPayload[K],
    provider: MailChannelsProvider
  ) => Promise<{ success: boolean; error?: string; retryable?: boolean }>;
} = {
  "order-created": handleOrderCreated,
  "order-confirmation": handleOrderConfirmation,
  "order-cancelled": handleOrderCancelled,
  "password-reset": handlePasswordReset,
  "shipping-update": handleShippingUpdate,
  "staff-invite": handleStaffInvite,
};

const MAX_ATTEMPTS = 3;

export const emailWorker = new Worker(
  "email",
  async (job: Job<EmailJobPayload[EmailJobType]>) => {
    const type = job.name as EmailJobType;
    const handler = HANDLERS[type];

    if (!handler) {
      throw Object.assign(new Error(`Unknown job type: ${type}`), {
        retryable: false,
      });
    }

    // P1 FIX: parsed.output (the validated, typed result) is now passed to the
    // handler instead of the raw job.data as any. Previously the validation
    // was a no-op — parsed output was discarded and the unvalidated payload was
    // forwarded, bypassing every schema constraint.
    const schema = PAYLOAD_SCHEMAS[type];
    if (schema) {
      const parsed = v.safeParse(schema, job.data);
      if (!parsed.success) {
        const message = parsed.issues
          .map((e) => `${e.path?.map((p) => p.key).join(".") ?? "(root)"}: ${e.message}`)
          .join("; ");
        throw Object.assign(
          new Error(`Invalid payload for job type "${type}": ${message}`),
          { retryable: false }
        );
      }
      // Use the validated, coerced data — not the raw job.data
      const result = await (
        handler as (
          payload: typeof parsed.output,
          provider: MailChannelsProvider
        ) => Promise<{ success: boolean; error?: string; retryable?: boolean }>
      )(parsed.output, provider);

      if (!result.success) {
        throw Object.assign(new Error(result.error ?? "Send failed"), {
          retryable: result.retryable ?? true,
        });
      }

      return { sent: true, jobId: job.id, type };
    }

    // Fallback for job types without a schema (should not happen — all types
    // are covered in PAYLOAD_SCHEMAS, but satisfies the control-flow check).
    throw Object.assign(
      new Error(`No schema registered for job type: ${type}`),
      {
        retryable: false,
      }
    );
  },
  {
    connection: parseRedisUrl(env.REDIS_URL),
    concurrency: 5,
    limiter: { max: 50, duration: 60_000 },
  }
);

// ── Lifecycle hooks ────────────────────────────────────────────────────────────
emailWorker.on("completed", (job, result) => {
  incrementCounter("email_sent_total", { job_type: result.type ?? job.name });

  console.info(
    JSON.stringify({
      event: "email_sent",
      jobId: job.id,
      type: result.type,
    })
  );
});

// P1 FIX: err typed as `unknown` with a type guard instead of `any`.
// P1 FIX (PII): userEmail / email are redacted from failure logs.
//   Previously, every job failure logged the customer's email address in plain
//   text, causing PII accumulation in log aggregators (GDPR/UU PDP violation).
emailWorker.on("failed", (job, err: unknown) => {
  const attempt = job?.attemptsMade ?? 0;
  const isRetryableErr =
    typeof err === "object" && err !== null && "retryable" in err
      ? (err as { retryable: unknown }).retryable === true
      : true;
  const errMessage = err instanceof Error ? err.message : String(err);
  const isPermanent = !isRetryableErr || attempt >= MAX_ATTEMPTS;

  if (isPermanent) {
    incrementCounter("email_retry_total", { job_type: job?.name ?? "unknown" });
  } else {
    incrementCounter("email_failed_total", {
      job_type: job?.name ?? "unknown",
    });
  }

  console.error(
    JSON.stringify({
      event: isPermanent ? "email_permanently_failed" : "email_failed",
      jobId: job?.id,
      type: job?.name,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      retryable: isRetryableErr,
      error: errMessage,
      // PII redacted: email address replaced with orderId only for correlation
      orderId: job?.data
        ? ((job.data as Record<string, unknown>)["orderId"] ?? null)
        : null,
    })
  );

  if (isPermanent) {
    console.error(
      JSON.stringify({
        event: "ALERT_EMAIL_DEAD_LETTER",
        severity: "CRITICAL",
        jobId: job?.id,
        type: job?.name,
        message: `Email job permanently failed after ${attempt} attempt(s) — manual intervention required`,
        runbook:
          "Check BullMQ dashboard / Redis for job details. Re-queue via admin panel or CLI.",
      })
    );

    if (env.ALERT_WEBHOOK_URL) {
      fetch(env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 Email permanently failed: \`${job?.name}\` (jobId: ${job?.id})`,
          jobId: job?.id,
          type: job?.name,
          attempt,
          error: errMessage,
        }),
        signal: AbortSignal.timeout(5_000),
      }).catch((e: unknown) =>
        console.warn(
          JSON.stringify({ event: "alert_webhook_failed", error: String(e) })
        )
      );
    }
  }
});

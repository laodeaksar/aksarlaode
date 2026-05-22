import { Queue } from "bullmq";

import { env } from "@repo/env/email-worker";
import { parseRedisUrl } from "@repo/env/utils";

export type EmailJobType =
  | "order-created"
  | "order-confirmation"
  | "order-cancelled"
  | "password-reset"
  | "shipping-update"
  | "staff-invite";

export type EmailJobPayload = {
  "order-created": {
    orderId: string;
    userId: string;
    userEmail: string;
    grandTotal: number;
  };
  "order-confirmation": {
    orderId: string;
    userId?: string;
    userEmail: string;
    amount: number;
  };
  "order-cancelled": {
    orderId: string;
    userId?: string;
    userEmail: string;
    reason: string;
  };
  "password-reset": {
    userId: string;
    email: string;
    resetLink: string;
  };
  "shipping-update": {
    orderId: string;
    userId?: string;
    userEmail: string;
    trackingNumber: string;
    courierName: string;
    estimatedDate: string;
  };
  "staff-invite": {
    userId: string;
    email: string;
    name: string;
    role: string;
    inviteLink: string;
  };
};

export const emailQueue = new Queue("email", {
  connection: parseRedisUrl(env.REDIS_URL),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

// Idempotency key helpers — build deterministic jobIds so that re-enqueueing
// the same logical event (e.g. producer retries after a network timeout) does
// not result in duplicate emails. BullMQ deduplicates by jobId: if a job with
// the same ID already exists in the queue it is silently skipped.
function idempotencyKey(type: EmailJobType, parts: string[]): string {
  return `${type}:${parts.join(":")}`;
}

// Typed producer used by other services.
// jobId is set to a deterministic key so duplicate enqueues are idempotent.
export function add<T extends EmailJobType>(
  type: T,
  payload: EmailJobPayload[T],
  options?: { deduplicationWindowMs?: number }
): ReturnType<typeof emailQueue.add> {
  const raw = payload as Record<string, unknown>;

  // Build a stable key from the most specific identifiers available.
  const keyParts: string[] = [];
  if (typeof raw["orderId"] === "string") keyParts.push(raw["orderId"]);
  if (typeof raw["userId"] === "string") keyParts.push(raw["userId"]);
  if (keyParts.length === 0 && typeof raw["email"] === "string") {
    // password-reset / staff-invite have no orderId
    keyParts.push(raw["email"] as string);
  }

  const jobId = idempotencyKey(type, keyParts);

  // BullMQ deduplicates by jobId: if a job with the same ID already exists
  // in the waiting / active / delayed state it is silently skipped.
  // This prevents duplicate emails when producers retry a failed enqueue.
  // options.deduplicationWindowMs is reserved for future use with BullMQ Pro's
  // built-in deduplication TTL; for now jobId is sufficient.
  void options; // suppress unused-var warning

  return emailQueue.add(type, payload, { jobId });
}

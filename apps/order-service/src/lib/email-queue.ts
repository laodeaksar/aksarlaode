import { Queue } from "bullmq";

import { env } from "@repo/env/order";
import { parseRedisUrl } from "@repo/env/utils";

const connection = parseRedisUrl(env.REDIS_URL);

// Payload types kept in sync with email-worker's EmailJobPayload contract.
type OrderCreatedPayload = {
  orderId: string;
  userId: string;
  userEmail: string; // FIX EML-03: required so email-worker skips auth-service round-trip
  grandTotal: number;
};

const queue = new Queue("email", { connection });

export const emailQueue = {
  /**
   * Enqueue an "order-created" notification email.
   * Returns the BullMQ Job Promise so callers can .catch() it independently.
   */
  add: (type: "order-created", payload: OrderCreatedPayload) =>
    queue.add(type, payload),
};

import { Effect, Data } from "effect"
import { Queue }        from "bullmq"
import { env }          from "@repo/env"

class EmailQueueError extends Data.TaggedError("EmailQueueError")<{ cause: unknown }> {}

// Payload types that match email-worker's EmailJobPayload contract.
// userEmail is required so the worker can send without an auth-service round-trip.
type OrderConfirmationPayload = {
  orderId:   string
  userEmail: string
  amount:    number
}

type OrderCancelledPayload = {
  orderId:   string
  userEmail: string
  reason:    string
}

const queue = new Queue("email", {
  connection: { host: env.REDIS_HOST, port: env.REDIS_PORT, password: env.REDIS_PASSWORD },
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
  },
})

function addEffect<T>(jobName: string, payload: T) {
  return Effect.tryPromise({
    try:   () => queue.add(jobName, payload).then(() => undefined),
    catch: (e) => new EmailQueueError({ cause: e }),
  })
}

// Effect-based producers used with yield* inside Effect.gen blocks.
export const emailQueue = {
  add: (
    type:    "order-confirmation",
    payload: OrderConfirmationPayload
  ) => addEffect(type, payload),

  addCancelled: (
    payload: OrderCancelledPayload
  ) => addEffect("order-cancelled", payload),
}

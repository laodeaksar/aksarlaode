import { Queue } from "bullmq"

import { env } from "@repo/env"

export type EmailJobType =
  | "order-created"
  | "order-confirmation"
  | "order-cancelled"
  | "password-reset"
  | "shipping-update"

// FIX EML-03: all order-related payloads now include userEmail so handlers
// can send email without an extra auth-service round-trip.
// userId is kept for backward compat and fallback lookup.
export type EmailJobPayload = {
  "order-created": {
    orderId: string
    userId: string
    userEmail: string // FIX: was missing → handler sent to UUID, not email
    grandTotal: number
  }
  "order-confirmation": {
    orderId: string
    userId?: string
    userEmail: string // FIX: was missing → fetchUserEmail was undefined
    amount: number
  }
  "order-cancelled": {
    orderId: string
    userId?: string
    userEmail: string // FIX: was missing → handler sent to UUID, not email
    reason: string
  }
  "password-reset": {
    userId: string
    email: string
    resetLink: string
  }
  "shipping-update": {
    orderId: string
    userId?: string
    userEmail: string // FIX: was missing → handler sent to UUID, not email
    trackingNumber: string
    courierName: string
    estimatedDate: string
  }
}

export const emailQueue = new Queue("email", {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})

// Typed producer — used by other services
export const add = <T extends EmailJobType>(
  type: T,
  payload: EmailJobPayload[T]
) => emailQueue.add(type, payload)

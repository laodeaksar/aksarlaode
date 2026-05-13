import { Queue } from "bullmq"
import { env }   from "@repo/env"

export type EmailJobType =
  | "order-created"
  | "order-confirmation"
  | "order-cancelled"
  | "password-reset"
  | "shipping-update"

export type EmailJobPayload = {
  "order-created": {
    orderId:    string
    userId:     string
    grandTotal: number
  }
  "order-confirmation": {
    orderId: string
    userId:  string
    amount:  number
  }
  "order-cancelled": {
    orderId: string
    userId:  string
    reason:  string
  }
  "password-reset": {
    userId:    string
    email:     string
    resetLink: string
  }
  "shipping-update": {
    orderId:        string
    userId:         string
    trackingNumber: string
    courierName:    string
    estimatedDate:  string
  }
}

export const emailQueue = new Queue("email", {
  connection: { host: env.REDIS_HOST, port: env.REDIS_PORT, password: env.REDIS_PASSWORD },
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
  },
})

// Typed producer — used by other services
export const add = <T extends EmailJobType>(
  type:    T,
  payload: EmailJobPayload[T]
) => emailQueue.add(type, payload)

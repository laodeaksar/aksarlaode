// Valibot schemas used by the POST /queue/enqueue endpoint.
// Only the three order-related job types make sense to manually trigger
// from the admin panel. password-reset and staff-invite are system-initiated
// and should not be triggerable via the queue dashboard.

import * as v from "valibot";

export const EnqueueSchema = v.variant("type", [
  v.object({
    type: v.literal("order-created"),
    payload: v.object({
      orderId: v.pipe(v.string(), v.minLength(1)),
      userId: v.pipe(v.string(), v.minLength(1)),
      userEmail: v.pipe(v.string(), v.email()),
      grandTotal: v.pipe(v.number(), v.minValue(1)),
    }),
  }),
  v.object({
    type: v.literal("order-confirmation"),
    payload: v.object({
      orderId: v.pipe(v.string(), v.minLength(1)),
      userId: v.pipe(v.string(), v.minLength(1)),
      userEmail: v.pipe(v.string(), v.email()),
      amount: v.pipe(v.number(), v.minValue(1)),
    }),
  }),
  v.object({
    type: v.literal("order-cancelled"),
    payload: v.object({
      orderId: v.pipe(v.string(), v.minLength(1)),
      userEmail: v.pipe(v.string(), v.email()),
      reason: v.pipe(v.string(), v.minLength(1)),
    }),
  }),
]);

export type EnqueueInput = v.InferOutput<typeof EnqueueSchema>;

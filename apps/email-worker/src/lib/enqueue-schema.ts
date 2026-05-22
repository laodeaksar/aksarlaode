// Zod schemas used by the POST /queue/enqueue endpoint.
// Only the three order-related job types make sense to manually trigger
// from the admin panel. password-reset and staff-invite are system-initiated
// and should not be triggerable via the queue dashboard.

import { z } from "zod";

export const EnqueueSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("order-created"),
    payload: z.object({
      orderId: z.string().min(1),
      userId: z.string().min(1),
      userEmail: z.string().email(),
      grandTotal: z.number().positive(),
    }),
  }),
  z.object({
    type: z.literal("order-confirmation"),
    payload: z.object({
      orderId: z.string().min(1),
      userId: z.string().min(1),
      userEmail: z.string().email(),
      amount: z.number().positive(),
    }),
  }),
  z.object({
    type: z.literal("order-cancelled"),
    payload: z.object({
      orderId: z.string().min(1),
      userEmail: z.string().email(),
      reason: z.string().min(1),
    }),
  }),
]);

export type EnqueueInput = z.infer<typeof EnqueueSchema>;

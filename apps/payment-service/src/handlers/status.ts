import { Effect } from "effect";

import type { Context } from "hono";

import { paymentRepository } from "@/repository/payment.repository";
import type { AppEnv } from "@/types";

export const statusHandler = async (c: Context<AppEnv>) => {
  const orderId = c.req.param("orderId");

  const result = await Effect.runPromiseExit(
    paymentRepository.findByOrderId(orderId)
  );

  if (result._tag === "Failure") {
    return c.json({ error: "Payment not found" }, 404);
  }

  return c.json(result.value);
};

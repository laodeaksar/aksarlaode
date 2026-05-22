import { Data, Effect } from "effect";

import { env } from "@repo/env/payment";

class OrderClientError extends Data.TaggedError("OrderClientError")<{
  status: number;
}> {}

const headers = () => ({
  "Content-Type": "application/json",
  "x-service-token": env.INTERNAL_SERVICE_TOKEN,
});

export const orderClient = {
  updateStatus: (orderId: string, status: string) =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          `${env.ORDER_SERVICE_URL}/orders/${orderId}/status`,
          {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ status }),
          }
        );
        if (!res.ok) throw { status: res.status };
      },
      catch: (e: any) => new OrderClientError({ status: e.status ?? 500 }),
    }),

  releaseStock: (orderId: string) =>
    Effect.tryPromise({
      try: async () => {
        const res = await fetch(
          `${env.ORDER_SERVICE_URL}/orders/${orderId}/release-stock`,
          { method: "POST", headers: headers() }
        );
        if (!res.ok) throw { status: res.status };
      },
      catch: (e: any) => new OrderClientError({ status: e.status ?? 500 }),
    }),
};

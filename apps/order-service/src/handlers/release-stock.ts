import { Effect } from "effect";

import type { Context } from "elysia";

import { env } from "@repo/env/order";

import { productClient } from "@/lib/product-client";
import { orderRepository } from "@/repository/order.repository";

export const releaseStockHandler = async ({
  params,
  headers,
  set,
}: Context) => {
  const { orderId } = params as { orderId: string };

  // ── Authorization — internal service calls only ──────────────────────────
  const serviceToken = headers["x-service-token"];
  if (serviceToken !== env.INTERNAL_SERVICE_TOKEN) {
    set.status = 403;
    return { error: "Forbidden", code: "FORBIDDEN" };
  }

  // Fetch order to get line items
  const orderResult = await Effect.runPromiseExit(
    orderRepository.findByOrderId(orderId)
  );

  if (orderResult._tag === "Failure") {
    set.status = 404;
    return { error: "Order not found" };
  }

  const order = orderResult.value;

  // Release stock for every line item in parallel
  const releaseResult = await Effect.runPromiseExit(
    Effect.all(
      order.items.map((item) =>
        productClient.releaseStock(item.productId, item.quantity)
      ),
      { concurrency: "unbounded" }
    )
  );

  if (releaseResult._tag === "Failure") {
    set.status = 502;
    return { error: "Failed to release stock to product service" };
  }

  return { message: "Stock released", orderId, itemCount: order.items.length };
};

import { Effect } from "effect";

import type { Context } from "elysia";

import { shapeOrder } from "@/lib/shape-order";
import {
  OrderConflictError,
  orderRepository,
} from "@/repository/order.repository";

export const cancelHandler = async ({ params, headers, set }: Context) => {
  const { orderId } = params as { orderId: string };
  const userId = headers["x-user-id"]!;

  const result = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const order = yield* orderRepository.checkOwnership(orderId, userId);

      // Only PENDING_PAYMENT and PAID orders are customer-cancellable.
      // We perform this check here (not in updateStatus) because we already
      // have the document from checkOwnership — avoids a redundant DB fetch.
      if (order.status !== "PENDING_PAYMENT" && order.status !== "PAID") {
        return yield* Effect.fail(
          new OrderConflictError({ reason: "invalid_transition" })
        );
      }

      return yield* orderRepository.updateStatus(orderId, "CANCELLED");
    })
  );

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string };
    if (err._tag === "OrderNotFoundError") {
      set.status = 404;
      return { error: "Order not found", code: "ORDER_NOT_FOUND" };
    }
    if (err._tag === "OrderConflictError") {
      set.status = 409;
      return {
        error: "Cannot cancel order in its current status",
        code: "INVALID_STATUS_TRANSITION",
      };
    }
    set.status = 500;
    return { error: "Failed to cancel order" };
  }

  const shaped = shapeOrder(result.value as Record<string, any>);

  // Sanity-check: cancellation must always produce a cancelledAt timestamp
  if (!shaped.cancelledAt) {
    console.error(
      JSON.stringify({
        event: "cancel_missing_cancelledAt",
        orderId,
        status: shaped.status,
      })
    );
  }

  return shaped;
};

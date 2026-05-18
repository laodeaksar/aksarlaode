import { Effect } from "effect";

import type { Context } from "elysia";

import { shapeOrder } from "@/lib/shape-order";
import { orderRepository } from "@/repository/order.repository";

export const listHandler = async ({ query, headers, set }: Context) => {
  const userId = headers["x-user-id"]!;
  const q = query as { page?: string; limit?: string };
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));

  const result = await Effect.runPromiseExit(
    orderRepository.findByUser(userId, page, limit)
  );

  if (result._tag === "Failure") {
    set.status = 500;
    return { error: "Failed to fetch orders" };
  }

  const { items, total } = result.value;
  const totalPages = Math.ceil(total / limit);

  return {
    items: items.map((doc) => shapeOrder(doc as Record<string, any>)),
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

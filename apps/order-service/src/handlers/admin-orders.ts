import { Effect } from "effect";

import type { Context } from "elysia";

import { shapeOrder } from "@/lib/shape-order";
import type { OrderStatus } from "@/models/order.model";
import {
  orderRepository,
  type AdminOrderFilters,
} from "@/repository/order.repository";

const VALID_STATUSES = new Set<OrderStatus>([
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const adminListOrdersHandler = async ({
  query,
  headers,
  set,
}: Context) => {
  // ── Authorization — ADMIN role required (service token already checked by plugin) ─
  if (headers["x-user-role"] !== "ADMIN") {
    set.status = 403;
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" };
  }

  const q = query as {
    page?: string;
    limit?: string;
    userId?: string;
    status?: string; // comma-separated: "PAID,PROCESSING"
    dateFrom?: string; // ISO 8601
    dateTo?: string; // ISO 8601
  };

  // ── Parse & validate pagination ───────────────────────────────────────────
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));

  // ── Parse & validate status filter ───────────────────────────────────────
  let statusFilter: OrderStatus[] | undefined;

  if (q.status) {
    const requested = q.status
      .split(",")
      .map((s) => s.trim().toUpperCase()) as OrderStatus[];
    const invalid = requested.filter((s) => !VALID_STATUSES.has(s));

    if (invalid.length > 0) {
      set.status = 422;
      return {
        error: `Invalid status values: ${invalid.join(", ")}`,
        code: "INVALID_STATUS",
      };
    }
    statusFilter = requested;
  }

  // ── Parse & validate date filters ─────────────────────────────────────────
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (q.dateFrom) {
    dateFrom = new Date(q.dateFrom);
    if (isNaN(dateFrom.getTime())) {
      set.status = 422;
      return {
        error: "Invalid dateFrom — must be ISO 8601",
        code: "INVALID_DATE",
      };
    }
  }

  if (q.dateTo) {
    dateTo = new Date(q.dateTo);
    if (isNaN(dateTo.getTime())) {
      set.status = 422;
      return {
        error: "Invalid dateTo — must be ISO 8601",
        code: "INVALID_DATE",
      };
    }
    dateTo.setHours(23, 59, 59, 999);
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    set.status = 422;
    return {
      error: "dateFrom must be before dateTo",
      code: "INVALID_DATE_RANGE",
    };
  }

  // ── Build filters object ──────────────────────────────────────────────────
  const filters: AdminOrderFilters = {
    page,
    limit,
    userId: q.userId || undefined,
    status: statusFilter,
    dateFrom,
    dateTo,
  };

  const result = await Effect.runPromiseExit(orderRepository.findAll(filters));

  if (result._tag === "Failure") {
    console.error(
      JSON.stringify({
        event: "admin_list_orders_error",
        filters: {
          ...filters,
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString(),
        },
      })
    );
    set.status = 500;
    return { error: "Failed to fetch orders" };
  }

  const {
    items,
    total,
    page: pg,
    limit: lim,
    totalPages,
    hasNext,
    hasPrev,
  } = result.value;

  return {
    items: items.map((doc) => shapeOrder(doc as Record<string, any>)),
    total,
    page: pg,
    limit: lim,
    totalPages,
    hasNext,
    hasPrev,
    filters: {
      userId: filters.userId ?? null,
      status: filters.status ?? null,
      dateFrom: filters.dateFrom?.toISOString() ?? null,
      dateTo: filters.dateTo?.toISOString() ?? null,
    },
  };
};

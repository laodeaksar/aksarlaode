import Elysia, { t }                 from "elysia"
import { env }                        from "@repo/env/order"
import { adminReconciliationHandler } from "@/handlers/admin-reconciliation"
import { adminListOrdersHandler }     from "@/handlers/admin-orders"
import { adminOrdersSummaryHandler }  from "@/handlers/admin-orders-summary"
import { adminOrderTimelineHandler }  from "@/handlers/admin-order-timeline"
import { adminOrderNoteHandler }      from "@/handlers/admin-order-note"

const ErrorSchema = t.Object({
  error: t.String(),
  code:  t.Optional(t.String()),
})

const SweepResultSchema = t.Object({
  triggeredBy:    t.String(),
  startedAt:      t.String(),
  completedAt:    t.String(),
  durationMs:     t.Number(),
  expiryMins:     t.Number(),
  total:          t.Integer(),
  cancelled:      t.Integer(),
  stockReleased:  t.Integer(),
  stockFailed:    t.Integer(),
  alreadyHandled: t.Integer(),
  skipped:        t.Integer(),
})

export const adminRoutes = new Elysia({ prefix: "/admin", tags: ["Admin"] })

  // ── Service token guard — all /admin routes require a trusted gateway token ─
  .onBeforeHandle(({ headers, set }) => {
    const serviceToken = headers["x-service-token"]
    if (serviceToken !== env.INTERNAL_SERVICE_TOKEN) {
      set.status = 401
      return { error: "Unauthorized", code: "MISSING_SERVICE_TOKEN" }
    }
  })

  // ── GET /admin/orders ──────────────────────────────────────────────────────
  .get("/orders", adminListOrdersHandler, {
    query: t.Object({
      page:     t.Optional(t.String({ description: "Page number (default: 1)" })),
      limit:    t.Optional(t.String({ description: "Items per page, max 100 (default: 20)" })),
      userId:   t.Optional(t.String({ description: "Filter by exact userId" })),
      status:   t.Optional(t.String({
        description: "Comma-separated status values. Valid: PENDING_PAYMENT, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED",
        examples:    ["PAID,PROCESSING", "CANCELLED"],
      })),
      dateFrom: t.Optional(t.String({
        description: "ISO 8601 start date (inclusive). Orders created on or after this date.",
        examples:    ["2024-01-01", "2024-05-13T00:00:00.000Z"],
      })),
      dateTo:   t.Optional(t.String({
        description: "ISO 8601 end date (inclusive, extended to end of day 23:59:59). Orders created on or before this date.",
        examples:    ["2024-12-31", "2024-05-13T23:59:59.999Z"],
      })),
    }),
    response: {
      200: t.Object({
        items:      t.Array(t.Any()),
        total:      t.Integer(),
        page:       t.Integer(),
        limit:      t.Integer(),
        totalPages: t.Integer(),
        hasNext:    t.Boolean(),
        hasPrev:    t.Boolean(),
        filters:    t.Object({
          userId:   t.Union([t.String(), t.Null()]),
          status:   t.Union([t.Array(t.String()), t.Null()]),
          dateFrom: t.Union([t.String(), t.Null()]),
          dateTo:   t.Union([t.String(), t.Null()]),
        }),
      }),
      403: ErrorSchema,
      422: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "List all orders (admin)",
      description: [
        "Paginated view of all orders across all users. All filters are optional and composable.",
        "Requires ADMIN role (x-user-role: ADMIN) in addition to the service token.",
        "Results are sorted by createdAt descending (newest first).",
        "Use dateFrom/dateTo to scope investigations to a specific time window.",
        "Use status=PAID,PROCESSING to filter multiple statuses in one request.",
      ].join(" "),
    },
  })

  // ── GET /admin/orders/summary ─────────────────────────────────────────────
  .get("/orders/summary", adminOrdersSummaryHandler, {
    query: t.Object({
      userId:   t.Optional(t.String({ description: "Scope to a single user" })),
      dateFrom: t.Optional(t.String({
        description: "ISO 8601 start date (inclusive)",
        examples:    ["2024-01-01", "2024-05-01T00:00:00.000Z"],
      })),
      dateTo: t.Optional(t.String({
        description: "ISO 8601 end date (inclusive, extended to 23:59:59)",
        examples:    ["2024-12-31", "2024-05-31T23:59:59.999Z"],
      })),
    }),
    response: {
      200: t.Object({
        period: t.Object({
          dateFrom: t.Union([t.String(), t.Null()]),
          dateTo:   t.Union([t.String(), t.Null()]),
          userId:   t.Union([t.String(), t.Null()]),
        }),
        overall: t.Object({
          totalOrders:      t.Integer(),
          totalRevenue:     t.Number(),
          paidRevenue:      t.Number(),
          avgOrderValue:    t.Number(),
          cancelledCount:   t.Integer(),
          cancellationRate: t.Number(),
          refundedCount:    t.Integer(),
          refundedRevenue:  t.Number(),
        }),
        byStatus: t.Array(t.Object({
          status:        t.String(),
          orderCount:    t.Integer(),
          totalRevenue:  t.Number(),
          avgOrderValue: t.Number(),
          minOrderValue: t.Number(),
          maxOrderValue: t.Number(),
        })),
        dailyTrend: t.Array(t.Object({
          date:       t.String(),
          orderCount: t.Integer(),
          revenue:    t.Number(),
        })),
      }),
      403: ErrorSchema,
      422: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Order summary & KPIs (admin)",
      description: [
        "Single-query MongoDB $facet aggregation returning per-status breakdown, overall KPIs,",
        "and a daily revenue trend chart (only populated when date range ≤ 90 days).",
        "paidRevenue includes orders in PAID, PROCESSING, SHIPPED, and DELIVERED states.",
        "cancellationRate is expressed as a percentage (0–100).",
        "Requires ADMIN role.",
      ].join(" "),
    },
  })

  // ── GET /admin/orders/:orderId/timeline ──────────────────────────────────
  .get("/orders/:orderId/timeline", adminOrderTimelineHandler, {
    params: t.Object({
      orderId: t.String({ description: "Order ID (e.g. ORD-20240513-A3F9B2C1)" }),
    }),
    response: {
      200: t.Object({
        orderId:       t.String(),
        userId:        t.String(),
        currentStatus: t.String(),
        grandTotal:    t.Number(),
        createdAt:     t.Union([t.String(), t.Null()]),
        isTerminal:    t.Boolean(),
        summary: t.Object({
          eventCount:         t.Integer(),
          totalDurationMs:    t.Number(),
          totalDurationHuman: t.String(),
          openedAt:           t.Union([t.String(), t.Null()]),
          closedAt:           t.Union([t.String(), t.Null()]),
        }),
        timeline: t.Array(t.Object({
          index:          t.Integer(),
          status:         t.String(),
          note:           t.Union([t.String(), t.Null()]),
          changedBy:      t.String(),
          timestamp:      t.String(),
          durationSince:  t.Union([t.Number(), t.Null()]),
          durationHuman:  t.Union([t.String(), t.Null()]),
          isCurrentState: t.Boolean(),
        })),
      }),
      403: ErrorSchema,
      404: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Order audit timeline (admin)",
      description: [
        "Returns the full status-change history for a single order, enriched with actor identity,",
        "per-step elapsed time, and human-readable durations.",
        "Non-terminal orders include a live 'ongoing' marker showing elapsed time since the last status change.",
        "Terminal statuses: DELIVERED, CANCELLED, REFUNDED.",
        "Requires ADMIN role.",
      ].join(" "),
    },
  })

  // ── POST /admin/orders/:orderId/note ─────────────────────────────────────
  .post("/orders/:orderId/note", adminOrderNoteHandler, {
    params: t.Object({
      orderId: t.String({ description: "Order ID (e.g. ORD-20240513-A3F9B2C1)" }),
    }),
    body: t.Object({
      note: t.String({
        minLength: 1,
        maxLength: 1000,
        description: "Internal note text visible only to admins (max 1000 chars)",
      }),
    }),
    response: {
      201: t.Object({
        orderId: t.String(),
        entry: t.Object({
          status:    t.String(),
          note:      t.String(),
          changedBy: t.String(),
          timestamp: t.String(),
        }),
      }),
      403: ErrorSchema,
      404: ErrorSchema,
      422: ErrorSchema,
      500: ErrorSchema,
    },
    detail: {
      summary: "Add internal note to order (admin)",
      description: [
        "Appends an internal note to the order's status history WITHOUT changing its status.",
        "The entry is stored with a sentinel status of '__NOTE__' so timeline consumers can",
        "distinguish notes from real status transitions and render them differently (e.g. a comment bubble).",
        "Notes are admin-only and never exposed on the customer-facing order endpoints.",
        "Requires ADMIN role.",
      ].join(" "),
    },
  })

  // ── POST /admin/reconciliation/trigger ────────────────────────────────────
  .post("/reconciliation/trigger", adminReconciliationHandler, {
    response: {
      200: SweepResultSchema,
      403: ErrorSchema,
      409: ErrorSchema,
    },
    detail: {
      summary: "Trigger reconciliation sweep",
      description: [
        "Immediately runs the expired-order sweep without waiting for the next scheduled interval.",
        "Finds all PENDING_PAYMENT orders older than PAYMENT_EXPIRY_MINUTES, atomically cancels them,",
        "and releases their reserved stock back to inventory.",
        "Protected by a distributed Redis lock — returns 409 if a sweep is already running.",
        "Requires ADMIN role or a valid x-service-token header.",
      ].join(" "),
    },
  })

  // ── GET /admin/reconciliation/status ──────────────────────────────────────
  .get("/reconciliation/status", async () => {
    const { redis } = await import("@/lib/redis")
    const lockHolder = await redis.get("reconciliation:sweep:lock")
    return {
      sweepInProgress: lockHolder !== null,
      lockedBy:        lockHolder ?? null,
    }
  }, {
    response: {
      200: t.Object({
        sweepInProgress: t.Boolean(),
        lockedBy:        t.Union([t.String(), t.Null()]),
      }),
    },
    detail: {
      summary:     "Reconciliation sweep status",
      description: "Returns whether a sweep is currently in progress and who triggered it.",
    },
  })

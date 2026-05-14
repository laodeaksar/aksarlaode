import { Effect, Data }  from "effect"
import { OrderModel, type OrderStatus, type OrderDocument } from "@/models/order.model"

class OrderNotFoundError  extends Data.TaggedError("OrderNotFoundError")<{ id: string }> {}
class OrderConflictError  extends Data.TaggedError("OrderConflictError")<{ reason: string }> {}
class DbError             extends Data.TaggedError("DbError")<{ cause: unknown }> {}
class DuplicateOrderError extends Data.TaggedError("DuplicateOrderError")<{ orderId: string }> {}

const create = (data: Omit<OrderDocument, keyof Document>) =>
  Effect.tryPromise({
    try:   () => OrderModel.create(data),
    catch: (e: any) => {
      // MongoDB duplicate key — unique index on orderId
      if (e?.code === 11000) return new DuplicateOrderError({ orderId: data.orderId as string })
      return new DbError({ cause: e })
    },
  })

const findByOrderId = (orderId: string) =>
  Effect.gen(function* () {
    const doc = yield* Effect.tryPromise({
      try:   () => OrderModel.findOne({ orderId }).lean(),
      catch: (e) => new DbError({ cause: e }),
    })
    if (!doc) return yield* Effect.fail(new OrderNotFoundError({ id: orderId }))
    return doc
  })

const findByUser = (userId: string, page = 1, limit = 20) =>
  Effect.tryPromise({
    try: async () => {
      const skip = (page - 1) * limit
      const [items, total] = await Promise.all([
        OrderModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        OrderModel.countDocuments({ userId }),
      ])
      return { items, total, page, limit }
    },
    catch: (e) => new DbError({ cause: e }),
  })

// Append to statusHistory + update top-level status field
const updateStatus = (orderId: string, status: OrderStatus, note?: string, changedBy = "system") =>
  Effect.gen(function* () {
    const timestampField: Partial<Record<string, Date>> = {
      PAID:      new Date(),
      SHIPPED:   new Date(),
      DELIVERED: new Date(),
      CANCELLED: new Date(),
    }

    const doc = yield* Effect.tryPromise({
      try: () =>
        OrderModel.findOneAndUpdate(
          { orderId },
          {
            $set:  { status, ...( timestampField[status] ? { [`${status.toLowerCase()}At`]: timestampField[status] } : {} ) },
            $push: { statusHistory: { status, note, changedBy, timestamp: new Date() } },
          },
          { new: true }
        ).lean(),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!doc) return yield* Effect.fail(new OrderNotFoundError({ id: orderId }))
    return doc
  })

/**
 * Atomically transitions PENDING_PAYMENT → CANCELLED only if the order is
 * still in PENDING_PAYMENT state. Returns the updated doc, or null if the
 * order was already in a different state (race condition with webhook) or
 * does not exist. Never throws — callers check for null.
 */
const cancelIfPending = (orderId: string, changedBy = "system:reconciliation") =>
  Effect.tryPromise({
    try: () =>
      OrderModel.findOneAndUpdate(
        { orderId, status: "PENDING_PAYMENT" },  // condition: only cancel if still pending
        {
          $set:  { status: "CANCELLED", cancelledAt: new Date() },
          $push: { statusHistory: {
            status:    "CANCELLED",
            note:      "payment_expired",
            changedBy,
            timestamp: new Date(),
          }},
        },
        { new: true }
      ).lean(),
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Returns all PENDING_PAYMENT orders whose createdAt is older than
 * `expiryMinutes` minutes. Used by the reconciliation sweep.
 */
const findExpiredPending = (expiryMinutes: number) =>
  Effect.tryPromise({
    try: () => {
      const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000)
      return OrderModel
        .find({ status: "PENDING_PAYMENT", createdAt: { $lt: cutoff } })
        .select("orderId items")   // only the fields the reconciler needs
        .lean()
    },
    catch: (e) => new DbError({ cause: e }),
  })

const checkOwnership = (orderId: string, userId: string) =>
  Effect.gen(function* () {
    const order = yield* findByOrderId(orderId)
    if (order.userId !== userId) {
      return yield* Effect.fail(new OrderConflictError({ reason: "not_owner" }))
    }
    return order
  })

export type AdminOrderFilters = {
  userId?:   string
  status?:   OrderStatus[]
  dateFrom?: Date
  dateTo?:   Date
  page?:     number
  limit?:    number
}

/**
 * Paginated cross-user order listing for admin monitoring.
 * All filter fields are optional and composable.
 */
const findAll = (filters: AdminOrderFilters = {}) =>
  Effect.tryPromise({
    try: async () => {
      const { userId, status, dateFrom, dateTo, page = 1, limit = 20 } = filters
      const skip = (page - 1) * limit

      const query: Record<string, unknown> = {}
      if (userId)               query.userId  = userId
      if (status?.length)       query.status  = { $in: status }
      if (dateFrom || dateTo) {
        const range: Record<string, Date> = {}
        if (dateFrom) range.$gte = dateFrom
        if (dateTo)   range.$lte = dateTo
        query.createdAt = range
      }

      const [items, total] = await Promise.all([
        OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        OrderModel.countDocuments(query),
      ])

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      }
    },
    catch: (e) => new DbError({ cause: e }),
  })

export type SummaryFilters = {
  userId?:   string
  dateFrom?: Date
  dateTo?:   Date
}

export type StatusBucket = {
  status:        string
  orderCount:    number
  totalRevenue:  number
  avgOrderValue: number
  minOrderValue: number
  maxOrderValue: number
}

export type DailyBucket = {
  date:       string   // "YYYY-MM-DD"
  orderCount: number
  revenue:    number
}

export type OrderSummary = {
  period: { dateFrom: string | null; dateTo: string | null; userId: string | null }
  overall: {
    totalOrders:      number
    totalRevenue:     number
    paidRevenue:      number   // PAID + PROCESSING + SHIPPED + DELIVERED
    avgOrderValue:    number
    cancelledCount:   number
    cancellationRate: number   // 0–100 %
    refundedCount:    number
    refundedRevenue:  number
  }
  byStatus: StatusBucket[]
  // Only populated when date range ≤ 90 days; empty array otherwise
  dailyTrend: DailyBucket[]
}

// Revenue-generating statuses (payment was received)
const PAID_STATUSES_SET = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"])

/**
 * Single aggregation pipeline that returns:
 * - per-status breakdown (count + revenue metrics)
 * - overall totals + KPIs
 * - daily trend (when window ≤ 90 days)
 */
const summarize = (filters: SummaryFilters = {}) =>
  Effect.tryPromise({
    try: async (): Promise<OrderSummary> => {
      const { userId, dateFrom, dateTo } = filters

      // Build $match stage
      const match: Record<string, unknown> = {}
      if (userId) match.userId = userId
      if (dateFrom || dateTo) {
        const range: Record<string, Date> = {}
        if (dateFrom) range.$gte = dateFrom
        if (dateTo)   range.$lte = dateTo
        match.createdAt = range
      }

      const [facetResult] = await OrderModel.aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        {
          $facet: {
            // ── Per-status metrics ─────────────────────────────────────────
            byStatus: [
              {
                $group: {
                  _id:           "$status",
                  orderCount:    { $sum: 1 },
                  totalRevenue:  { $sum: "$grandTotal" },
                  avgOrderValue: { $avg: "$grandTotal" },
                  minOrderValue: { $min: "$grandTotal" },
                  maxOrderValue: { $max: "$grandTotal" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            // ── Overall single-pass totals ─────────────────────────────────
            overall: [
              {
                $group: {
                  _id:          null,
                  totalOrders:  { $sum: 1 },
                  totalRevenue: { $sum: "$grandTotal" },
                  sumGrandTotal:{ $sum: "$grandTotal" },
                  count:        { $sum: 1 },
                  // Tag each doc so we can sum only paid/cancelled/refunded
                  paidRevenue: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["PAID","PROCESSING","SHIPPED","DELIVERED"]] },
                        "$grandTotal",
                        0,
                      ],
                    },
                  },
                  cancelledCount: {
                    $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
                  },
                  refundedCount: {
                    $sum: { $cond: [{ $eq: ["$status", "REFUNDED"] }, 1, 0] },
                  },
                  refundedRevenue: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "REFUNDED"] }, "$grandTotal", 0],
                    },
                  },
                },
              },
            ],
            // ── Daily trend (always computed; we slice to 90 days in JS) ───
            dailyTrend: [
              {
                $group: {
                  _id:        { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  orderCount: { $sum: 1 },
                  revenue:    { $sum: "$grandTotal" },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ])

      // ── Shape overall ──────────────────────────────────────────────────────
      const ov = facetResult?.overall?.[0] ?? {}
      const totalOrders    = ov.totalOrders    ?? 0
      const totalRevenue   = ov.totalRevenue   ?? 0
      const paidRevenue    = ov.paidRevenue    ?? 0
      const cancelledCount = ov.cancelledCount ?? 0
      const refundedCount  = ov.refundedCount  ?? 0
      const refundedRevenue= ov.refundedRevenue ?? 0
      const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const cancellationRate = totalOrders > 0
        ? Math.round((cancelledCount / totalOrders) * 10_000) / 100   // 2 decimal places
        : 0

      // ── Shape byStatus ─────────────────────────────────────────────────────
      const byStatus: StatusBucket[] = (facetResult?.byStatus ?? []).map((b: any) => ({
        status:        b._id,
        orderCount:    b.orderCount,
        totalRevenue:  Math.round(b.totalRevenue  * 100) / 100,
        avgOrderValue: Math.round(b.avgOrderValue * 100) / 100,
        minOrderValue: Math.round(b.minOrderValue * 100) / 100,
        maxOrderValue: Math.round(b.maxOrderValue * 100) / 100,
      }))

      // ── Daily trend — only include when date window ≤ 90 days ─────────────
      const windowDays = dateFrom && dateTo
        ? (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)
        : null

      const dailyTrend: DailyBucket[] = (windowDays === null || windowDays <= 90)
        ? (facetResult?.dailyTrend ?? []).map((d: any) => ({
            date:       d._id,
            orderCount: d.orderCount,
            revenue:    Math.round(d.revenue * 100) / 100,
          }))
        : []

      return {
        period: {
          dateFrom: dateFrom?.toISOString() ?? null,
          dateTo:   dateTo?.toISOString()   ?? null,
          userId:   userId ?? null,
        },
        overall: {
          totalOrders,
          totalRevenue:    Math.round(totalRevenue    * 100) / 100,
          paidRevenue:     Math.round(paidRevenue     * 100) / 100,
          avgOrderValue:   Math.round(avgOrderValue   * 100) / 100,
          cancelledCount,
          cancellationRate,
          refundedCount,
          refundedRevenue: Math.round(refundedRevenue * 100) / 100,
        },
        byStatus,
        dailyTrend,
      }
    },
    catch: (e) => new DbError({ cause: e }),
  })

/**
 * Appends an internal admin note to statusHistory WITHOUT changing the order
 * status.  The entry re-uses the current status so timeline rendering stays
 * consistent.  Returns the updated document.
 */
const addNote = (orderId: string, note: string, changedBy: string) =>
  Effect.gen(function* () {
    const doc = yield* Effect.tryPromise({
      try: () =>
        OrderModel.findOneAndUpdate(
          { orderId },
          {
            $push: {
              statusHistory: {
                status:    "__NOTE__",   // sentinel — not an OrderStatus transition
                note,
                changedBy,
                timestamp: new Date(),
              },
            },
          },
          { new: true }
        ).lean(),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!doc) return yield* Effect.fail(new OrderNotFoundError({ id: orderId }))
    return doc
  })

export const orderRepository = {
  create, findByOrderId, findByUser, findAll, summarize, updateStatus,
  cancelIfPending, findExpiredPending, checkOwnership, addNote,
}

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

export const orderRepository = {
  create, findByOrderId, findByUser, findAll, updateStatus,
  cancelIfPending, findExpiredPending, checkOwnership,
}

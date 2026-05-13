import { Effect, Data }  from "effect"
import { OrderModel, type OrderStatus, type OrderDocument } from "@/models/order.model"

class OrderNotFoundError  extends Data.TaggedError("OrderNotFoundError")<{ id: string }> {}
class OrderConflictError  extends Data.TaggedError("OrderConflictError")<{ reason: string }> {}
class DbError             extends Data.TaggedError("DbError")<{ cause: unknown }> {}

const create = (data: Omit<OrderDocument, keyof Document>) =>
  Effect.tryPromise({
    try:   () => OrderModel.create(data),
    catch: (e) => new DbError({ cause: e }),
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
const updateStatus = (orderId: string, status: OrderStatus, note?: string) =>
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
            $push: { statusHistory: { status, note, timestamp: new Date() } },
          },
          { new: true }
        ).lean(),
      catch: (e) => new DbError({ cause: e }),
    })

    if (!doc) return yield* Effect.fail(new OrderNotFoundError({ id: orderId }))
    return doc
  })

const checkOwnership = (orderId: string, userId: string) =>
  Effect.gen(function* () {
    const order = yield* findByOrderId(orderId)
    if (order.userId !== userId) {
      return yield* Effect.fail(new OrderConflictError({ reason: "not_owner" }))
    }
    return order
  })

export const orderRepository = {
  create, findByOrderId, findByUser, updateStatus, checkOwnership
}

import { Effect }          from "effect"
import type { Context }    from "elysia"
import { orderRepository } from "@/repository/order.repository"

// ── Fields projected for the customer — never expose raw Mongoose internals ──
function shapeOrder(doc: Record<string, any>) {
  return {
    orderId:        doc.orderId,
    userId:         doc.userId,
    status:         doc.status,
    items: (doc.items ?? []).map((i: Record<string, any>) => ({
      productId:   i.productId,
      productName: i.productName,
      sku:         i.sku,
      imageUrl:    i.imageUrl ?? null,
      price:       i.price,
      quantity:    i.quantity,
      subtotal:    i.subtotal,
    })),
    shippingAddress: {
      recipientName: doc.shippingAddress?.recipientName,
      phone:         doc.shippingAddress?.phone,
      street:        doc.shippingAddress?.street,
      city:          doc.shippingAddress?.city,
      province:      doc.shippingAddress?.province,
      postalCode:    doc.shippingAddress?.postalCode,
      country:       doc.shippingAddress?.country ?? "ID",
    },
    totalAmount:    doc.totalAmount,
    shippingFee:    doc.shippingFee    ?? 0,
    discountAmount: doc.discountAmount ?? 0,
    grandTotal:     doc.grandTotal,
    notes:          doc.notes ?? null,
    // ── Timeline: strip __NOTE__ sentinel entries (admin-only internal notes) ──
    // Customers should only see real status transitions, not admin annotations.
    statusHistory: (doc.statusHistory ?? [])
      .filter((e: Record<string, any>) => e.status !== "__NOTE__")
      .map((e: Record<string, any>) => ({
        status:    e.status,
        note:      e.note   ?? null,
        changedBy: e.changedBy ?? "system",
        timestamp: new Date(e.timestamp).toISOString(),
      })),
    createdAt:   doc.createdAt   ? new Date(doc.createdAt).toISOString()   : null,
    updatedAt:   doc.updatedAt   ? new Date(doc.updatedAt).toISOString()   : null,
    paidAt:      doc.paidAt      ? new Date(doc.paidAt).toISOString()      : null,
    shippedAt:   doc.shippedAt   ? new Date(doc.shippedAt).toISOString()   : null,
    deliveredAt: doc.deliveredAt ? new Date(doc.deliveredAt).toISOString() : null,
    cancelledAt: doc.cancelledAt ? new Date(doc.cancelledAt).toISOString() : null,
  }
}

export const getOneHandler = async ({ params, headers, set }: Context) => {
  const { orderId } = params as { orderId: string }
  const userId      = headers["x-user-id"]!
  const role        = headers["x-user-role"]

  // Admins may view any order; regular users are gated by ownership check
  const program = role === "ADMIN"
    ? orderRepository.findByOrderId(orderId)
    : orderRepository.checkOwnership(orderId, userId)

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag: string }
    if (err._tag === "OrderNotFoundError") {
      set.status = 404
      return { error: "Order not found", code: "ORDER_NOT_FOUND" }
    }
    if (err._tag === "OrderConflictError") {
      // Do not reveal existence of the order to a non-owner — return 404
      set.status = 404
      return { error: "Order not found", code: "ORDER_NOT_FOUND" }
    }
    set.status = 500
    return { error: "Failed to fetch order" }
  }

  return shapeOrder(result.value as Record<string, any>)
}

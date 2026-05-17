/**
 * Shared order projection for customer-facing endpoints.
 *
 * Rules:
 *  - Explicit allowlist only — no Mongoose internals (_id, __v) ever leak
 *  - __NOTE__ sentinel entries are stripped from statusHistory
 *    (those are admin-only annotations, invisible to customers)
 *  - All Date objects are converted to ISO 8601 strings
 */
export function shapeOrder(doc: Record<string, any>) {
  return {
    orderId: doc.orderId,
    userId: doc.userId,
    status: doc.status,
    items: (doc.items ?? []).map((i: Record<string, any>) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      imageUrl: i.imageUrl ?? null,
      price: i.price,
      quantity: i.quantity,
      subtotal: i.subtotal,
    })),
    shippingAddress: {
      recipientName: doc.shippingAddress?.recipientName,
      phone: doc.shippingAddress?.phone,
      street: doc.shippingAddress?.street,
      city: doc.shippingAddress?.city,
      province: doc.shippingAddress?.province,
      postalCode: doc.shippingAddress?.postalCode,
      country: doc.shippingAddress?.country ?? "ID",
    },
    totalAmount: doc.totalAmount,
    shippingFee: doc.shippingFee ?? 0,
    discountAmount: doc.discountAmount ?? 0,
    grandTotal: doc.grandTotal,
    notes: doc.notes ?? null,
    statusHistory: (doc.statusHistory ?? [])
      .filter((e: Record<string, any>) => e.status !== "__NOTE__")
      .map((e: Record<string, any>) => ({
        status: e.status,
        note: e.note ?? null,
        changedBy: e.changedBy ?? "system",
        timestamp: new Date(e.timestamp).toISOString(),
      })),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : null,
    shippedAt: doc.shippedAt ? new Date(doc.shippedAt).toISOString() : null,
    deliveredAt: doc.deliveredAt
      ? new Date(doc.deliveredAt).toISOString()
      : null,
    cancelledAt: doc.cancelledAt
      ? new Date(doc.cancelledAt).toISOString()
      : null,
  }
}

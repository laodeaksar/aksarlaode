import { Effect }          from "effect"
import type { Context }    from "elysia"
import { orderRepository } from "@/repository/order.repository"
import { productClient }   from "@/lib/product-client"
import { emailQueue }      from "@/lib/email-queue"
import { generateOrderId } from "@/lib/order-id"
import { idempotency }     from "@/lib/idempotency"
import type { CreateOrderBody } from "@/types"

export const createHandler = async ({ body, headers, set }: Context) => {
  const input  = body as CreateOrderBody
  const userId = headers["x-user-id"]!

  // ── Idempotency check ────────────────────────────────────────────────────
  const idempotencyKey = headers["idempotency-key"] as string | undefined

  if (idempotencyKey) {
    const check = await idempotency.getOrLock(idempotencyKey)

    if (check.state === "hit") {
      set.status = check.result.status
      return check.result.body
    }

    if (check.state === "pending") {
      set.status = 409
      return {
        error: "A request with this Idempotency-Key is already in progress",
        code:  "REQUEST_IN_FLIGHT",
      }
    }
    // state === "free" → lock acquired, continue to order creation
  }

  // ── Main order creation ──────────────────────────────────────────────────
  const program = Effect.gen(function* () {
    // Reserve stock with rollback compensation on partial failure
    const reserved: Array<{ productId: string; quantity: number }> = []

    for (const item of input.items) {
      const reserveResult = yield* Effect.either(
        productClient.reserveStock(item.productId, item.quantity)
      )

      if (reserveResult._tag === "Left") {
        // Rollback all previously reserved stock before propagating failure
        yield* Effect.all(
          reserved.map(r => productClient.releaseStock(r.productId, r.quantity)),
          { concurrency: "unbounded" }
        )
        return yield* Effect.fail(reserveResult.left)
      }

      reserved.push({ productId: item.productId, quantity: item.quantity })
    }

    const totalAmount = input.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const grandTotal  = totalAmount + (input.shippingFee ?? 0) - (input.discountAmount ?? 0)

    const order = yield* orderRepository.create({
      orderId:         generateOrderId(),
      userId,
      status:          "PENDING_PAYMENT",
      items:           input.items.map(i => ({ ...i, subtotal: i.price * i.quantity })),
      shippingAddress: input.shippingAddress,
      statusHistory:   [{ status: "PENDING_PAYMENT", timestamp: new Date() }],
      totalAmount,
      shippingFee:     input.shippingFee    ?? 0,
      discountAmount:  input.discountAmount ?? 0,
      grandTotal,
      notes:           input.notes,
    })

    // Non-blocking — fire and forget; failure does not abort order creation
    emailQueue
      .add("order-created", { orderId: order.orderId, userId, grandTotal })
      .catch(err =>
        console.error(JSON.stringify({ event: "email_queue_error", error: String(err) }))
      )

    return { orderId: order.orderId, grandTotal: order.grandTotal, status: order.status }
  })

  const result = await Effect.runPromiseExit(program)

  // ── Failure path ─────────────────────────────────────────────────────────
  if (result._tag === "Failure") {
    // Release idempotency lock so the client can retry
    if (idempotencyKey) await idempotency.fail(idempotencyKey)

    const err = result.cause.error as { _tag?: string }
    if (err._tag === "InsufficientStockError") { set.status = 409; return { error: "Insufficient stock" } }
    if (err._tag === "ProductNotFoundError")   { set.status = 404; return { error: "Product not found" } }
    if (err._tag === "ProductClientError")     { set.status = 502; return { error: "Product service unavailable" } }
    set.status = 500
    return { error: "Order creation failed" }
  }

  // ── Success path ─────────────────────────────────────────────────────────
  const responseBody = result.value

  // Cache result so identical retries return the same response without side effects
  if (idempotencyKey) {
    await idempotency.complete(idempotencyKey, { status: 201, body: responseBody })
  }

  set.status = 201
  return responseBody
}

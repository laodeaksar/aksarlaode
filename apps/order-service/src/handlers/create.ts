import { Effect }           from "effect"
import type { Context }     from "hono"
import { orderRepository }  from "@/repository/order.repository"
import { productClient }    from "@/lib/product-client"
import { emailQueue }       from "@/lib/email-queue"
import { generateOrderId }  from "@/lib/order-id"
import { CreateOrderSchema } from "@repo/common"
import type { AppEnv }      from "@/types"

export const createHandler = async (c: Context<AppEnv>) => {
  const userId = c.req.header("x-user-id")!
  const body   = await c.req.json()

  const program = Effect.gen(function* () {
    // 1. Validate input
    const input = yield* Effect.try({
      try:   () => CreateOrderSchema.parse(body),
      catch: () => ({ _tag: "ValidationError" as const }),
    })

    // 2. Verify + reserve stock for all items (parallel)
    yield* Effect.all(
      input.items.map(item =>
        productClient.reserveStock(item.productId, item.quantity)
      ),
      { concurrency: "unbounded" }
    )

    // 3. Calculate totals
    const totalAmount  = input.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const grandTotal   = totalAmount + (input.shippingFee ?? 0) - (input.discountAmount ?? 0)

    // 4. Persist order
    const order = yield* orderRepository.create({
      orderId:         generateOrderId(),
      userId,
      status:          "PENDING_PAYMENT",
      items:           input.items.map(i => ({
        ...i,
        subtotal: i.price * i.quantity,
      })),
      shippingAddress: input.shippingAddress,
      statusHistory:   [{ status: "PENDING_PAYMENT", timestamp: new Date() }],
      totalAmount,
      shippingFee:     input.shippingFee    ?? 0,
      discountAmount:  input.discountAmount ?? 0,
      grandTotal,
      notes:           input.notes,
    })

    // 5. Queue confirmation email (non-blocking)
    yield* emailQueue.add("order-created", {
      orderId: order.orderId,
      userId,
      grandTotal,
    })

    return {
      orderId:    order.orderId,
      grandTotal: order.grandTotal,
      status:     order.status,
    }
  })

  const result = await Effect.runPromiseExit(program)

  if (result._tag === "Failure") {
    const err = result.cause.error as { _tag?: string }
    if (err._tag === "ValidationError")      return c.json({ error: "Invalid input" }, 422)
    if (err._tag === "InsufficientStockError") return c.json({ error: "Insufficient stock" }, 409)
    if (err._tag === "ProductNotFoundError") return c.json({ error: "Product not found" }, 404)
    return c.json({ error: "Order creation failed" }, 500)
  }

  return c.json(result.value, 201)
}

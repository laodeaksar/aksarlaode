import { Effect } from "effect";

import type { Context } from "elysia";

import { env } from "@repo/env/order";

import { authClient } from "@/lib/auth-client";
import { emailQueue } from "@/lib/email-queue";
import { idempotency } from "@/lib/idempotency";
import { generateOrderId } from "@/lib/order-id";
import { productClient } from "@/lib/product-client";
import { checkOrderCreateRateLimit } from "@/lib/rate-limiter";
import { orderRepository } from "@/repository/order.repository";
import type { CreateOrderBody } from "@/types";

// FIX ORD-03: Strip HTML tags from customer-supplied text before persisting.
// Prevents XSS in admin panel where notes may be rendered as HTML.
// Keeps plain text content intact; only angle-bracket markup is removed.
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

export const createHandler = async ({ body, headers, set }: Context) => {
  const input = body as CreateOrderBody;
  const userId = headers["x-user-id"]!;

  // ── Rate limit — sliding window per userId ────────────────────────────────
  // Checked before the idempotency lock so a rate-limited request does not
  // consume an idempotency slot or touch downstream services.
  const rl = await checkOrderCreateRateLimit(userId);

  set.headers["X-RateLimit-Limit"] = String(rl.limit);
  set.headers["X-RateLimit-Remaining"] = String(rl.remaining);
  set.headers["X-RateLimit-Reset"] = String(Math.ceil(rl.resetMs / 1000)); // Unix seconds

  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.resetMs - Date.now()) / 1000);
    set.headers["Retry-After"] = String(retryAfterSec);
    set.status = 429;
    return {
      error: "Too many order requests — please slow down",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfterSec,
    };
  }

  // FIX ORD-04: Scope the key to userId + method + path + rawKey.
  // Without the method+path component, the same Idempotency-Key header value
  // sent to two different endpoints by the same user would collide and one
  // endpoint would incorrectly return the other's cached response.
  const rawKey = headers["idempotency-key"] as string;
  const idempotencyKey = `${userId}:POST:/orders:${rawKey}`;

  const check = await idempotency.getOrLock(idempotencyKey);

  if (check.state === "hit") {
    set.status = check.result.status;
    return check.result.body;
  }

  if (check.state === "pending") {
    set.status = 409;
    return {
      error: "A request with this Idempotency-Key is already in progress",
      code: "REQUEST_IN_FLIGHT",
    };
  }
  // state === "free" → lock acquired, continue to order creation

  // ── Main order creation ──────────────────────────────────────────────────
  const program = Effect.gen(function* () {
    // ── 1. Fetch authoritative prices from product-service ──────────────────
    //    Never trust client-supplied prices — always override with server data.
    const verifiedItems: Array<{
      productId: string;
      productName: string;
      sku: string;
      price: number;
      quantity: number;
      imageUrl?: string;
    }> = [];

    for (const item of input.items) {
      const productResult = yield* Effect.either(
        productClient.getProduct(item.productId)
      );
      if (productResult._tag === "Left") {
        return yield* Effect.fail(productResult.left);
      }
      const product = productResult.right;
      verifiedItems.push({
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        price: product.price, // ← server price, not client price
        quantity: item.quantity,
        imageUrl: product.imageUrl,
      });
    }

    // ── 2. Reserve stock with rollback compensation ─────────────────────────
    const reserved: Array<{ productId: string; quantity: number }> = [];

    for (const item of verifiedItems) {
      const reserveResult = yield* Effect.either(
        productClient.reserveStock(item.productId, item.quantity)
      );

      if (reserveResult._tag === "Left") {
        yield* Effect.all(
          reserved.map((r) =>
            productClient.releaseStock(r.productId, r.quantity)
          ),
          { concurrency: "unbounded" }
        );
        return yield* Effect.fail(reserveResult.left);
      }

      reserved.push({ productId: item.productId, quantity: item.quantity });
    }

    // ── 3. Compute totals — shippingFee from server config; discount rejected ─
    //    discountAmount is NOT accepted from client body to prevent manipulation.
    const totalAmount = verifiedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );
    const grandTotal = Math.max(
      env.MINIMUM_ORDER_AMOUNT,
      totalAmount + (input.shippingFee ?? 0)
    );

    const order = yield* orderRepository.create({
      orderId: generateOrderId(),
      userId,
      status: "PENDING_PAYMENT",
      items: verifiedItems.map((i) => ({
        ...i,
        subtotal: i.price * i.quantity,
      })),
      shippingAddress: input.shippingAddress,
      statusHistory: [
        { status: "PENDING_PAYMENT", changedBy: userId, timestamp: new Date() },
      ],
      totalAmount,
      shippingFee: input.shippingFee ?? 0,
      discountAmount: 0,
      grandTotal,
      notes: input.notes != null ? stripHtml(input.notes) : undefined,
    });

    // Non-blocking — fire and forget; failure does not abort order creation.
    // Resolve userEmail first (also non-blocking): if auth-service is down
    // userEmail falls back to "" and email-worker's user-client handles it.
    authClient
      .fetchUserEmail(userId)
      .catch(() => "")
      .then((userEmail) =>
        emailQueue.add("order-created", {
          orderId: order.orderId,
          userId,
          userEmail,
          grandTotal,
        })
      )
      .catch((err) =>
        console.error(
          JSON.stringify({ event: "email_queue_error", error: String(err) })
        )
      );

    return {
      orderId: order.orderId,
      grandTotal: order.grandTotal,
      status: order.status,
    };
  });

  const result = await Effect.runPromiseExit(program);

  // ── Failure path ─────────────────────────────────────────────────────────
  if (result._tag === "Failure") {
    // Release idempotency lock so the client can retry
    await idempotency.fail(idempotencyKey);

    const err = result.cause.error as { _tag?: string };
    if (err._tag === "InsufficientStockError") {
      set.status = 409;
      return { error: "Insufficient stock", code: "INSUFFICIENT_STOCK" };
    }
    if (err._tag === "ProductNotFoundError") {
      set.status = 404;
      return { error: "Product not found", code: "PRODUCT_NOT_FOUND" };
    }
    if (err._tag === "ProductClientError") {
      set.status = 502;
      return {
        error: "Product service unavailable",
        code: "PRODUCT_SERVICE_UNAVAILABLE",
      };
    }
    if (err._tag === "DuplicateOrderError") {
      set.status = 409;
      return {
        error: "Duplicate order ID, please retry",
        code: "DUPLICATE_ORDER_ID",
      };
    }
    set.status = 500;
    return { error: "Order creation failed" };
  }

  // ── Success path ─────────────────────────────────────────────────────────
  const responseBody = result.value;

  // Cache result so identical retries return the same response without side effects
  await idempotency.complete(idempotencyKey, {
    status: 201,
    body: responseBody,
  });

  set.status = 201;
  return responseBody;
};

import { Worker, Queue } from "bullmq"
import { Effect }        from "effect"
import { env }           from "@repo/env/order"
import { orderRepository } from "@/repository/order.repository"
import { productClient }   from "@/lib/product-client"

// ── Shared Redis connection options (used by Queue + Worker) ─────────────────
const connection = {
  host:     env.REDIS_HOST,
  port:     env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
}

const QUEUE_NAME = "reconciliation"
const JOB_NAME   = "sweep-expired-orders"

// ── Core sweep logic ─────────────────────────────────────────────────────────
async function sweepExpiredOrders(): Promise<void> {
  const findResult = await Effect.runPromiseExit(
    orderRepository.findExpiredPending(env.PAYMENT_EXPIRY_MINUTES)
  )

  if (findResult._tag === "Failure") {
    console.error(JSON.stringify({
      event: "reconciliation_db_error",
      note:  "Failed to query expired orders",
    }))
    throw new Error("DB query failed")   // re-throw so BullMQ marks job as failed + retries
  }

  const expiredOrders = findResult.value

  if (expiredOrders.length === 0) {
    console.info(JSON.stringify({ event: "reconciliation_no_expired_orders" }))
    return
  }

  console.info(JSON.stringify({
    event:      "reconciliation_sweep_start",
    count:      expiredOrders.length,
    expiryMins: env.PAYMENT_EXPIRY_MINUTES,
  }))

  let cancelled = 0
  let stockReleased = 0
  let stockFailed = 0

  for (const order of expiredOrders) {
    // ── Atomic cancel — no-op if payment webhook already processed this order ─
    const cancelResult = await Effect.runPromiseExit(
      orderRepository.cancelIfPending(order.orderId)
    )

    if (cancelResult._tag === "Failure") {
      console.error(JSON.stringify({
        event:   "reconciliation_cancel_error",
        orderId: order.orderId,
      }))
      continue   // skip stock release for this order; will be retried next sweep
    }

    if (cancelResult.value === null) {
      // Order was already transitioned by webhook — nothing to do
      console.info(JSON.stringify({
        event:   "reconciliation_order_already_handled",
        orderId: order.orderId,
      }))
      continue
    }

    cancelled++

    // ── Release reserved stock ───────────────────────────────────────────────
    const releaseResult = await Effect.runPromiseExit(
      Effect.all(
        order.items.map(item =>
          productClient.releaseStock(item.productId, item.quantity)
        ),
        { concurrency: "unbounded" }
      )
    )

    if (releaseResult._tag === "Failure") {
      stockFailed++
      console.error(JSON.stringify({
        event:     "reconciliation_stock_release_failed",
        orderId:   order.orderId,
        itemCount: order.items.length,
        items:     order.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      }))
    } else {
      stockReleased++
      console.info(JSON.stringify({
        event:     "reconciliation_stock_released",
        orderId:   order.orderId,
        itemCount: order.items.length,
      }))
    }
  }

  console.info(JSON.stringify({
    event:        "reconciliation_sweep_complete",
    total:        expiredOrders.length,
    cancelled,
    stockReleased,
    stockFailed,
  }))
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────
export function createReconciliationWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_NAME) await sweepExpiredOrders()
    },
    {
      connection,
      concurrency: 1,   // only one sweep at a time, even across multiple instances
    }
  )

  worker.on("completed", (job) => {
    console.info(JSON.stringify({ event: "reconciliation_job_completed", jobId: job.id }))
  })

  worker.on("failed", (job, err) => {
    console.error(JSON.stringify({
      event:  "reconciliation_job_failed",
      jobId:  job?.id,
      error:  err.message,
    }))
  })

  return worker
}

// ── BullMQ Queue — schedules the repeatable job ───────────────────────────────
export async function scheduleReconciliationJob() {
  const queue = new Queue(QUEUE_NAME, { connection })

  // Upsert the repeatable job. BullMQ deduplicates by (name + repeat options),
  // so calling this on every service start is safe and idempotent.
  await queue.add(
    JOB_NAME,
    {},
    {
      repeat:    { every: env.RECONCILIATION_INTERVAL_MS },
      jobId:     JOB_NAME,   // stable ID prevents queue flooding on restart
      removeOnComplete: { count: 50 },   // keep last 50 completed jobs for debugging
      removeOnFail:     { count: 100 },  // keep last 100 failed jobs for inspection
    }
  )

  console.info(JSON.stringify({
    event:        "reconciliation_job_scheduled",
    intervalMs:   env.RECONCILIATION_INTERVAL_MS,
    expiryMins:   env.PAYMENT_EXPIRY_MINUTES,
  }))

  await queue.close()
}

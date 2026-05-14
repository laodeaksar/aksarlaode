import { Worker, Queue } from "bullmq"
import { Effect }        from "effect"
import { env }           from "@repo/env/order"
import { redis }         from "@/lib/redis"
import { orderRepository } from "@/repository/order.repository"
import { productClient }   from "@/lib/product-client"

// ── Shared Redis connection options (used by Queue + Worker) ─────────────────
const connection = {
  host:     env.REDIS_HOST,
  port:     env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
}

const QUEUE_NAME  = "reconciliation"
const JOB_NAME    = "sweep-expired-orders"
const SWEEP_LOCK  = "reconciliation:sweep:lock"
const LOCK_TTL    = 300   // seconds — max expected sweep duration

// ── Result shape returned by runSweep ────────────────────────────────────────
export type SweepResult = {
  triggeredBy:  string
  startedAt:    string
  completedAt:  string
  durationMs:   number
  expiryMins:   number
  total:        number
  cancelled:    number
  stockReleased: number
  stockFailed:  number
  alreadyHandled: number
  skipped:      number
}

// ── Core sweep logic — exported so the admin handler can call it directly ────
export async function runSweep(triggeredBy: string): Promise<SweepResult | { locked: true }> {
  // Distributed lock — prevents concurrent scheduled + manual sweeps
  const lockAcquired = await redis.set(SWEEP_LOCK, triggeredBy, "EX", LOCK_TTL, "NX")
  if (!lockAcquired) {
    console.warn(JSON.stringify({ event: "reconciliation_sweep_locked", triggeredBy }))
    return { locked: true }
  }

  const startedAt = new Date()

  let total          = 0
  let cancelled      = 0
  let stockReleased  = 0
  let stockFailed    = 0
  let alreadyHandled = 0
  let skipped        = 0

  try {
    const findResult = await Effect.runPromiseExit(
      orderRepository.findExpiredPending(env.PAYMENT_EXPIRY_MINUTES)
    )

    if (findResult._tag === "Failure") {
      console.error(JSON.stringify({
        event:       "reconciliation_db_error",
        triggeredBy,
        note:        "Failed to query expired orders",
      }))
      throw new Error("DB query failed")
    }

    const expiredOrders = findResult.value
    total = expiredOrders.length

    if (total === 0) {
      console.info(JSON.stringify({ event: "reconciliation_no_expired_orders", triggeredBy }))
    } else {
      console.info(JSON.stringify({
        event:       "reconciliation_sweep_start",
        triggeredBy,
        count:       total,
        expiryMins:  env.PAYMENT_EXPIRY_MINUTES,
      }))
    }

    for (const order of expiredOrders) {
      // Atomic cancel — no-op if payment webhook already processed this order
      const cancelResult = await Effect.runPromiseExit(
        orderRepository.cancelIfPending(order.orderId, `system:reconciliation(${triggeredBy})`)
      )

      if (cancelResult._tag === "Failure") {
        skipped++
        console.error(JSON.stringify({
          event:       "reconciliation_cancel_error",
          orderId:     order.orderId,
          triggeredBy,
        }))
        continue
      }

      if (cancelResult.value === null) {
        alreadyHandled++
        console.info(JSON.stringify({
          event:       "reconciliation_order_already_handled",
          orderId:     order.orderId,
          triggeredBy,
        }))
        continue
      }

      cancelled++

      // Release reserved stock for every line item in parallel
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
          event:       "reconciliation_stock_release_failed",
          orderId:     order.orderId,
          itemCount:   order.items.length,
          triggeredBy,
          items:       order.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        }))
      } else {
        stockReleased++
        console.info(JSON.stringify({
          event:       "reconciliation_stock_released",
          orderId:     order.orderId,
          itemCount:   order.items.length,
          triggeredBy,
        }))
      }
    }
  } finally {
    await redis.del(SWEEP_LOCK)
  }

  const completedAt = new Date()
  const durationMs  = completedAt.getTime() - startedAt.getTime()

  const result: SweepResult = {
    triggeredBy,
    startedAt:    startedAt.toISOString(),
    completedAt:  completedAt.toISOString(),
    durationMs,
    expiryMins:   env.PAYMENT_EXPIRY_MINUTES,
    total,
    cancelled,
    stockReleased,
    stockFailed,
    alreadyHandled,
    skipped,
  }

  console.info(JSON.stringify({ event: "reconciliation_sweep_complete", ...result }))

  return result
}

// ── BullMQ Worker ─────────────────────────────────────────────────────────────
export function createReconciliationWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_NAME) await runSweep("scheduler")
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
      repeat:           { every: env.RECONCILIATION_INTERVAL_MS },
      jobId:            JOB_NAME,   // stable ID prevents queue flooding on restart
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 100 },
    }
  )

  console.info(JSON.stringify({
    event:       "reconciliation_job_scheduled",
    intervalMs:  env.RECONCILIATION_INTERVAL_MS,
    expiryMins:  env.PAYMENT_EXPIRY_MINUTES,
  }))

  await queue.close()
}

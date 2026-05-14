import Elysia, { t }               from "elysia"
import { env }                      from "@repo/env/order"
import { adminReconciliationHandler } from "@/handlers/admin-reconciliation"

const ErrorSchema = t.Object({
  error: t.String(),
  code:  t.Optional(t.String()),
})

const SweepResultSchema = t.Object({
  triggeredBy:    t.String(),
  startedAt:      t.String(),
  completedAt:    t.String(),
  durationMs:     t.Number(),
  expiryMins:     t.Number(),
  total:          t.Integer(),
  cancelled:      t.Integer(),
  stockReleased:  t.Integer(),
  stockFailed:    t.Integer(),
  alreadyHandled: t.Integer(),
  skipped:        t.Integer(),
})

export const adminRoutes = new Elysia({ prefix: "/admin", tags: ["Admin"] })

  // ── Service token guard — all /admin routes require a trusted gateway token ─
  .onBeforeHandle(({ headers, set }) => {
    const serviceToken = headers["x-service-token"]
    if (serviceToken !== env.INTERNAL_SERVICE_TOKEN) {
      set.status = 401
      return { error: "Unauthorized", code: "MISSING_SERVICE_TOKEN" }
    }
  })

  .post("/reconciliation/trigger", adminReconciliationHandler, {
    response: {
      200: SweepResultSchema,
      403: ErrorSchema,
      409: ErrorSchema,
    },
    detail: {
      summary: "Trigger reconciliation sweep",
      description: [
        "Immediately runs the expired-order sweep without waiting for the next scheduled interval.",
        "Finds all PENDING_PAYMENT orders older than PAYMENT_EXPIRY_MINUTES, atomically cancels them,",
        "and releases their reserved stock back to inventory.",
        "Protected by a distributed Redis lock — returns 409 if a sweep is already running.",
        "Requires ADMIN role or a valid x-service-token header.",
      ].join(" "),
    },
  })

  .get("/reconciliation/status", async ({ set }) => {
    const { redis } = await import("@/lib/redis")
    const lockHolder = await redis.get("reconciliation:sweep:lock")
    return {
      sweepInProgress: lockHolder !== null,
      lockedBy:        lockHolder ?? null,
    }
  }, {
    response: {
      200: t.Object({
        sweepInProgress: t.Boolean(),
        lockedBy:        t.Union([t.String(), t.Null()]),
      }),
    },
    detail: {
      summary:     "Reconciliation sweep status",
      description: "Returns whether a sweep is currently in progress and who triggered it.",
    },
  })

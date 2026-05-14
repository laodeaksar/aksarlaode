import { Effect }       from "effect"
import type { Context } from "elysia"
import { orderRepository, type SummaryFilters } from "@/repository/order.repository"

export const adminOrdersSummaryHandler = async ({ query, headers, set }: Context) => {
  // ── Authorization — ADMIN role required (service token checked by plugin) ─
  if (headers["x-user-role"] !== "ADMIN") {
    set.status = 403
    return { error: "Forbidden — ADMIN role required", code: "FORBIDDEN" }
  }

  const q = query as { userId?: string; dateFrom?: string; dateTo?: string }

  // ── Parse & validate date filters ─────────────────────────────────────────
  let dateFrom: Date | undefined
  let dateTo:   Date | undefined

  if (q.dateFrom) {
    dateFrom = new Date(q.dateFrom)
    if (isNaN(dateFrom.getTime())) {
      set.status = 422
      return { error: "Invalid dateFrom — must be ISO 8601", code: "INVALID_DATE" }
    }
  }

  if (q.dateTo) {
    dateTo = new Date(q.dateTo)
    if (isNaN(dateTo.getTime())) {
      set.status = 422
      return { error: "Invalid dateTo — must be ISO 8601", code: "INVALID_DATE" }
    }
    dateTo.setHours(23, 59, 59, 999)
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    set.status = 422
    return { error: "dateFrom must be before dateTo", code: "INVALID_DATE_RANGE" }
  }

  const filters: SummaryFilters = {
    userId:   q.userId   || undefined,
    dateFrom,
    dateTo,
  }

  const result = await Effect.runPromiseExit(orderRepository.summarize(filters))

  if (result._tag === "Failure") {
    console.error(JSON.stringify({
      event:   "admin_summary_error",
      filters: {
        userId:   filters.userId   ?? null,
        dateFrom: filters.dateFrom?.toISOString() ?? null,
        dateTo:   filters.dateTo?.toISOString()   ?? null,
      },
    }))
    set.status = 500
    return { error: "Failed to compute order summary" }
  }

  return result.value
}

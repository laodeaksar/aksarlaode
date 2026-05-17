import { effectMiddleware } from "@/effect/Middleware"
import { ApiClientService } from "@/effect/Services"
import type { DashboardStats } from "@/effect/Services"
import { createServerFn } from "@tanstack/react-start"
import { Effect } from "effect"

// ── GET /admin/dashboard/stats ─────────────────────────────────────────────
// SSR loader for the Dashboard route — returns KPI cards, recent orders and
// top products in a single call. No input needed.

export const getDashboardStatsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware])
  .handler(
    async ({ context }): Promise<DashboardStats> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService
          return yield* api.dashboard.stats()
        })
      )
  )

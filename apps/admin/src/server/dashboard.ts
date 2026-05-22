import { createServerFn } from "@tanstack/react-start";

import { Effect } from "effect";

import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";
import type { DashboardStats } from "@/effect/Services";

// ── GET /admin/dashboard/stats ─────────────────────────────────────────────
// SSR loader for the Dashboard route — returns KPI cards, recent orders and
// top products in a single call. No input needed.
// requirePermission("dashboard:read") provides server-side defense-in-depth:
// the route's beforeLoad is a UI gate only and can be bypassed by direct
// HTTP calls to the server function endpoint.

export const getDashboardStatsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("dashboard:read")])
  .handler(
    async ({ context }): Promise<DashboardStats> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          return yield* api.dashboard.stats();
        })
      )
  );

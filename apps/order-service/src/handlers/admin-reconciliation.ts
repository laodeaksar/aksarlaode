import type { Context } from "elysia";

import { env } from "@repo/env/order";

import { runSweep } from "@/workers/reconciliation.worker";

export const adminReconciliationHandler = async ({ headers, set }: Context) => {
  // ── Authorization — ADMIN role or internal service token only ────────────
  const role = headers["x-user-role"];
  const serviceToken = headers["x-service-token"];

  if (role !== "ADMIN" && serviceToken !== env.INTERNAL_SERVICE_TOKEN) {
    set.status = 403;
    return { error: "Forbidden", code: "FORBIDDEN" };
  }

  const userId = headers["x-user-id"];
  const triggeredBy = userId ? `admin:${userId}` : "service:internal";

  const result = await runSweep(triggeredBy);

  if ("locked" in result) {
    set.status = 409;
    return {
      error: "A sweep is already in progress. Try again in a few seconds.",
      code: "SWEEP_IN_PROGRESS",
    };
  }

  return result;
};

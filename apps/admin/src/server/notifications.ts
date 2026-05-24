import { createServerFn } from "@tanstack/react-start";

import { Effect } from "effect";

import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";

/**
 * Lightweight server function — returns only the total count of
 * PENDING_PAYMENT orders.  Called on a polling interval from the
 * sidebar so the admin sees new-order badges without a full page reload.
 *
 * requirePermission("orders:read") ensures unauthenticated or insufficiently
 * privileged callers cannot probe order volume via direct HTTP calls.
 */
export const getPendingOrdersCountFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("orders:read")])
  .handler(
    async ({ context }): Promise<number> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          const result = yield* api.orders.list({
            page: 1,
            status: "PENDING_PAYMENT",
          });
          return result.total;
        })
      )
  );

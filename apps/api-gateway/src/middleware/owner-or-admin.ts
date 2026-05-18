import type { MiddlewareHandler } from "hono";

import { env } from "@repo/env/gateway";

import { getBreaker } from "@/lib/circuit-breaker";
import type { AppEnv } from "@/types/context";

// Fetches the order owner from order-service and compares to the requesting user.
// Admins and Owners bypass the check and pass through immediately.
//
// C-03 fixes applied:
//   1. Uses the ORDER circuit breaker — fail-fast when order-service is down
//   2. Passes c.var.abortSignal to fetch — honours the gateway-level timeout so
//      this call is cancelled when requestTimeout fires (no resource leak)
//   3. Reports success/failure to the breaker so state transitions are accurate
export const ownerOrAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.var.user;
  const orderId = c.req.param("id");

  if (!user) {
    return c.json(
      {
        error: "Unauthorized",
        code: "UNAUTHORIZED",
        requestId: c.var.requestId,
      },
      401
    );
  }

  if (user.role === "ADMIN" || user.role === "OWNER") return next();

  // ── Circuit breaker check — fail fast if order-service is degraded ────────
  const breaker = getBreaker("ORDER");
  if (!breaker.allow()) {
    return c.json(
      {
        error: "Service temporarily unavailable — please retry shortly",
        code: "CIRCUIT_OPEN",
        requestId: c.var.requestId,
      },
      503
    );
  }

  try {
    const res = await fetch(
      `${env.ORDER_SERVICE_URL}/orders/${orderId}/owner`,
      {
        headers: {
          "x-user-id": user.id,
          "x-service-token": env.INTERNAL_SERVICE_TOKEN,
          "x-request-id": c.var.requestId,
        },
        signal: c.var.abortSignal, // honours gateway-level timeout; no infinite hang
      }
    );

    if (res.ok) {
      breaker.success();
    } else {
      breaker.failure();
      return c.json(
        { error: "Forbidden", code: "FORBIDDEN", requestId: c.var.requestId },
        403
      );
    }
  } catch (e) {
    breaker.failure();
    // AbortError means requestTimeout fired — re-throw so requestTimeout middleware
    // can return the correct 504 response.
    if (e instanceof Error && e.name === "AbortError") throw e;
    return c.json(
      {
        error: "Service unavailable",
        code: "UPSTREAM_ERROR",
        requestId: c.var.requestId,
      },
      502
    );
  }

  await next();
};

import { Effect } from "effect";

import type { MiddlewareHandler } from "hono";

import { env } from "@repo/env/gateway";

import { getBreaker } from "@/lib/circuit-breaker";
import { verifyHmac } from "@/lib/hmac";
import { verifyJwt } from "@/lib/jwt";
import { PUBLIC_ROUTES, WEBHOOK_ROUTES } from "@/lib/route-permissions";
import type { AppEnv } from "@/types/context";

export const authResolver: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  // ── 1. Public routes — pass straight through ──────────────────────────────
  if (isPublic(path, method)) {
    c.set("authPayload", null);
    c.set("webhookRawBody", null);
    return next();
  }

  // ── 2. Webhook routes — HMAC signature only ───────────────────────────────
  if (isWebhook(path)) {
    // FIX GW-04: read body once and cache it in context so proxy.ts can forward
    // it without trying to re-read the already-consumed stream (which yields an
    // empty body and silently breaks every downstream webhook handler).
    const body = await c.req.text();
    const signature = c.req.header("x-midtrans-signature") ?? "";

    const verified = await Effect.runPromiseExit(verifyHmac(body, signature));

    if (verified._tag === "Failure") {
      return c.json(
        {
          error: "Invalid webhook signature",
          code: "UNAUTHORIZED",
          requestId: c.var.requestId,
        },
        401
      );
    }

    c.set("authPayload", { type: "webhook" });
    c.set("webhookRawBody", body);
    return next();
  }

  // ── 3. Protected routes — Bearer JWT ─────────────────────────────────────
  c.set("webhookRawBody", null);

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return c.json(
      {
        error: "Missing or malformed Authorization header",
        code: "UNAUTHORIZED",
        requestId: c.var.requestId,
      },
      401
    );
  }

  const result = await Effect.runPromiseExit(verifyJwt(token));

  if (result._tag === "Failure") {
    const cause = result.cause;
    const tag =
      cause._tag === "Fail"
        ? (cause.error as { _tag?: string })?._tag ?? ""
        : "";
    const code = tag === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
    return c.json(
      { error: "Invalid or expired token", code, requestId: c.var.requestId },
      401
    );
  }

  c.set("authPayload", result.value);

  // ── C-13: Session denylist check ──────────────────────────────────────────
  // Validates that the session hasn't been revoked after logout or an explicit
  // session-revoke call. Adds ~5–10 ms per request on the hot path.
  //
  // Failure policy — fail-open:
  //   A Redis or auth-service outage must NOT take down the gateway. If the
  //   denylist check cannot be completed, we let the JWT (which is
  //   cryptographically valid) pass through. The window of exposure is bounded
  //   by the JWT's own expiry (`exp` claim).
  //
  // Circuit breaker — AUTH breaker is reused so that repeated auth-service
  //   failures trip the breaker and skip future denylist checks automatically,
  //   preventing latency pile-up during an auth-service outage.
  const sessionId = (result.value as { sessionId?: string }).sessionId;
  if (sessionId) {
    const authBreaker = getBreaker("AUTH");
    if (authBreaker.allow()) {
      try {
        const res = await fetch(
          `${env.AUTH_SERVICE_URL}/session/internal/${sessionId}/valid`,
          {
            headers: { "x-service-token": env.INTERNAL_SERVICE_TOKEN },
            signal: c.var.abortSignal,
          }
        );

        if (res.status === 401 || res.status === 403) {
          // Auth-service explicitly says this session is revoked.
          // Count as success (upstream responded, not a 5xx).
          authBreaker.success();
          return c.json(
            {
              error: "Session has been revoked",
              code: "UNAUTHORIZED",
              requestId: c.var.requestId,
            },
            401
          );
        }

        if (res.ok) {
          authBreaker.success();
        } else {
          // Unexpected non-5xx status — log and fail-open.
          authBreaker.failure();
          console.warn(
            JSON.stringify({
              event: "session_denylist_unexpected_status",
              status: res.status,
              sessionId,
              requestId: c.var.requestId,
            })
          );
        }
      } catch (e) {
        // Network error, timeout, or AbortError — fail-open.
        authBreaker.failure();
        if (!(e instanceof Error && e.name === "AbortError")) {
          console.warn(
            JSON.stringify({
              event: "session_denylist_error",
              error: String(e),
              sessionId,
              requestId: c.var.requestId,
            })
          );
        }
      }
    }
    // Circuit OPEN → skip denylist check, fail-open, proceed with valid JWT.
  }
  // ─────────────────────────────────────────────────────────────────────────

  await next();
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function isPublic(path: string, method: string): boolean {
  return PUBLIC_ROUTES.some(
    (r) => r.path === path && (r.method === method || r.method === "*")
  );
}

function isWebhook(path: string): boolean {
  return WEBHOOK_ROUTES.some((r) => path.startsWith(r));
}

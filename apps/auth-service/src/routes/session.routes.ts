import { Elysia } from "elysia";

import { isSessionDenied } from "@/lib/session-denylist";
import { listSessionsHandler } from "@/handlers/list-sessions";
import { revokeSessionHandler } from "@/handlers/revoke-session";
import { SessionQuery } from "@/schemas";

const sessionRoutes = new Elysia({ prefix: "/session" })
  .get("/", listSessionsHandler, {
    query: SessionQuery,
    detail: {
      tags: ["Sessions"],
      summary: "List sessions",
      description:
        "Returns a paginated list of the authenticated user's active sessions, ordered by creation time descending.",
    },
  })
  .delete("/:id", revokeSessionHandler, {
    detail: {
      tags: ["Sessions"],
      summary: "Revoke session",
      description:
        "Invalidates a specific session by ID. Users may only revoke their own sessions.",
    },
  })

  /**
   * Internal endpoint consumed by the API gateway to check whether a
   * sessionId from a verified JWT has been explicitly revoked.
   *
   * The global serviceTokenMiddleware (applied in index.ts) already gates
   * this route — no additional auth needed here.
   *
   * Gateway integration pattern:
   *   After verifying the JWT signature + expiry in authResolver, call:
   *     GET /session/internal/:id/valid
   *     x-service-token: <INTERNAL_SERVICE_TOKEN>
   *   → 200 { valid: true }  — session is active, proceed
   *   → 401 { valid: false } — session was revoked, return 401 to client
   *
   * Latency: ~1–5 ms (Redis GET from same datacenter).
   * The gateway's circuit breaker handles auth-service downtime.
   */
  .get(
    "/internal/:id/valid",
    async ({ params, set }) => {
      const denied = await isSessionDenied(params.id);
      if (denied) {
        set.status = 401;
        return { valid: false, reason: "session_revoked" };
      }
      return { valid: true };
    },
    {
      detail: {
        tags: ["Sessions"],
        summary: "Check session validity (internal)",
        description:
          "Returns whether a sessionId is active in the denylist. Called by the API gateway to enforce immediate revocation of access tokens after logout or explicit session revocation. Requires x-service-token.",
      },
    }
  );

export default sessionRoutes;

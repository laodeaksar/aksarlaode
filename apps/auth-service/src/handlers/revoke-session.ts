import { Effect } from "effect";

import { AuthError, NotFoundError, toErrorResponse } from "@repo/common/errors";
import { message } from "@repo/common/response";

import { writeAuditLog } from "@/lib/audit-log";
import { denySession } from "@/lib/session-denylist";
import { sessionRepository } from "@/repository/session.repository";
import type { HandlerCtx } from "@/types";

export const revokeSessionHandler = async ({
  headers,
  params,
  set,
}: HandlerCtx) => {
  const userId = headers["x-user-id"];
  const sessionId = params["id"];

  if (!userId) {
    const { body, status } = toErrorResponse(new AuthError());
    set.status = status;
    return body;
  }

  if (!sessionId) {
    const { body, status } = toErrorResponse(
      new AuthError("Session ID required")
    );
    set.status = status;
    return body;
  }

  const program = Effect.gen(function* () {
    const session = yield* sessionRepository.findByIdAndUserId(
      sessionId,
      userId
    );
    if (!session) return yield* Effect.fail(new NotFoundError("Session"));
    yield* sessionRepository.deleteByIdAndUserId(sessionId, userId);
  });

  const result = await Effect.runPromiseExit(program);

  if (result._tag === "Failure") {
    const { body, status } = toErrorResponse(result.cause.error);
    set.status = status;
    return body;
  }

  // Add revoked sessionId to the denylist so any access token carrying that
  // sessionId is immediately rejected for the remaining access token TTL.
  // This closes the window where a revoked-session's access token would still
  // be accepted by the gateway (which only checks JWT signature and expiry).
  await denySession(sessionId);

  writeAuditLog({
    event: "SESSION_REVOKED",
    actorId: userId,
    targetId: userId,
    meta: { sessionId },
  });

  return message("Session revoked");
};

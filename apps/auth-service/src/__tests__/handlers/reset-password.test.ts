import { Effect } from "effect";

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeAuditLog } from "@/lib/audit-log";
import { hashPassword } from "@/lib/password";
import { resetPasswordHandler } from "@/handlers/reset-password";
import { consumeResetToken } from "@/repository/auth.repository";
import { resetTokenRepository } from "@/repository/reset-token.repository";
import { userRepository } from "@/repository/user.repository";
import { ResetPasswordBody } from "@/schemas";

import { MOCK_RESET_TOKEN, MOCK_USER } from "../fixtures";

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findById: vi.fn() },
}));
vi.mock("@/repository/reset-token.repository", () => ({
  resetTokenRepository: { findByToken: vi.fn(), deleteByToken: vi.fn() },
}));
// consumeResetToken is the atomic transaction: delete token + update password + delete sessions.
// The old separate updatePasswordHash / deleteByToken / deleteAllByUserId mocks are gone —
// those individual calls are now hidden inside consumeResetToken's transaction.
vi.mock("@/repository/auth.repository", () => ({
  consumeResetToken: vi.fn(),
  createUserWithSession: vi.fn(),
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  writeAuditLog: vi.fn(),
}));

const app = new Elysia().post("/reset-password", resetPasswordHandler, {
  body: ResetPasswordBody,
});

function post(body: unknown) {
  return app.handle(
    new Request("http://localhost/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const VALID_BODY = {
  token: MOCK_RESET_TOKEN.token,
  newPassword: "newSecret1!",
};

describe("resetPasswordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(
      Effect.succeed(MOCK_RESET_TOKEN)
    );
    vi.mocked(userRepository.findById).mockReturnValue(
      Effect.succeed(MOCK_USER)
    );
    vi.mocked(hashPassword).mockReturnValue(Effect.succeed("new:hash"));
    vi.mocked(consumeResetToken).mockReturnValue(Effect.succeed(undefined));
    // deleteByToken is called on the expired-token cleanup path (best-effort, Effect.orElse-wrapped)
    vi.mocked(resetTokenRepository.deleteByToken).mockReturnValue(
      Effect.succeed(undefined as any)
    );
  });

  it("returns 200 with success message on valid token and password", async () => {
    const res = await post(VALID_BODY);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toContain("reset successful");
  });

  it("delegates to consumeResetToken for atomic token delete + password update + session wipe", async () => {
    await post(VALID_BODY);
    expect(consumeResetToken).toHaveBeenCalledTimes(1);
    expect(consumeResetToken).toHaveBeenCalledWith(
      expect.any(String), // SHA-256 hash of MOCK_RESET_TOKEN.token
      MOCK_USER.id,
      "new:hash"
    );
  });

  it("does NOT call consumeResetToken for expired tokens (prevents wasted Argon2 hashing)", async () => {
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(
      Effect.succeed({ ...MOCK_RESET_TOKEN, expiresAt: new Date("2000-01-01") })
    );
    await post(VALID_BODY);
    expect(consumeResetToken).not.toHaveBeenCalled();
  });

  it("emits PASSWORD_RESET audit event on success", async () => {
    await post(VALID_BODY);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PASSWORD_RESET",
        actorId: MOCK_USER.id,
      })
    );
  });

  it("does not emit audit event when token is invalid", async () => {
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(
      Effect.succeed(null)
    );
    await post(VALID_BODY);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("returns 401 when token does not exist in DB", async () => {
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(
      Effect.succeed(null)
    );
    const res = await post(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 410 when token is expired", async () => {
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(
      Effect.succeed({ ...MOCK_RESET_TOKEN, expiresAt: new Date("2000-01-01") })
    );
    const res = await post(VALID_BODY);
    expect(res.status).toBe(410);
  });

  it("returns 401 when consumeResetToken reports token already consumed (concurrent replay)", async () => {
    const { ConflictError } = await import("@repo/common/errors");
    vi.mocked(consumeResetToken).mockReturnValue(
      Effect.fail(
        new ConflictError("token", "Reset token not found or already consumed")
      )
    );
    const res = await post(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 422 when newPassword is too short", async () => {
    const res = await post({
      token: MOCK_RESET_TOKEN.token,
      newPassword: "short",
    });
    expect(res.status).toBe(422);
  });

  it("clears the refresh cookie with Max-Age=0", async () => {
    const res = await post(VALID_BODY);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("clears cookie with Path=/auth to match the login cookie path", async () => {
    const res = await post(VALID_BODY);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("Path=/auth");
    expect(cookie).not.toContain("Path=/auth/refresh");
  });
});

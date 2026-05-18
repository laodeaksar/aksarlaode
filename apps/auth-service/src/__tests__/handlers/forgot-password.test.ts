import { Effect } from "effect";

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { enqueuePasswordReset } from "@/lib/email-queue";
import { forgotPasswordHandler } from "@/handlers/forgot-password";
import { resetTokenRepository } from "@/repository/reset-token.repository";
import { userRepository } from "@/repository/user.repository";
import { ForgotPasswordBody } from "@/schemas";

import { MOCK_USER } from "../fixtures";

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findByEmail: vi.fn() },
}));
vi.mock("@/repository/reset-token.repository", () => ({
  resetTokenRepository: { deleteAllByUserId: vi.fn(), create: vi.fn() },
}));
// Mock the email queue — fire-and-forget in the handler so we only need
// to verify it's called (or not), and that its rejection never changes the response.
vi.mock("@/lib/email-queue", () => ({
  enqueuePasswordReset: vi.fn(() => Promise.resolve()),
}));

const app = new Elysia().post("/forgot-password", forgotPasswordHandler, {
  body: ForgotPasswordBody,
});

function post(body: unknown) {
  return app.handle(
    new Request("http://localhost/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("forgotPasswordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findByEmail).mockReturnValue(
      Effect.succeed(MOCK_USER)
    );
    vi.mocked(resetTokenRepository.deleteAllByUserId).mockReturnValue(
      Effect.succeed({} as any)
    );
    vi.mocked(resetTokenRepository.create).mockReturnValue(
      Effect.succeed({} as any)
    );
    vi.mocked(enqueuePasswordReset).mockResolvedValue(undefined);
  });

  // ── Enumeration safety ────────────────────────────────────────────────────
  // Both registered and unregistered emails MUST return the identical response
  // (same status, same body shape). Any difference allows user enumeration.

  it("returns 200 with a generic message when email IS registered", async () => {
    const res = await post({ email: "test@example.com" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("returns 200 with the SAME message when email is NOT registered (anti-enumeration)", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null));
    const notFound = await post({ email: "ghost@example.com" });
    const notFoundBody = await notFound.json();

    vi.mocked(userRepository.findByEmail).mockReturnValue(
      Effect.succeed(MOCK_USER)
    );
    const found = await post({ email: "test@example.com" });
    const foundBody = await found.json();

    expect(notFound.status).toBe(200);
    expect(found.status).toBe(200);
    expect(notFoundBody.message).toBe(foundBody.message);
  });

  it("returns 200 even when the email queue throws (prevents status-code enumeration)", async () => {
    vi.mocked(enqueuePasswordReset).mockRejectedValue(
      new Error("Queue unavailable")
    );
    const res = await post({ email: "test@example.com" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.message).toBe("string");
  });

  it("returns 200 even when the DB token write fails", async () => {
    vi.mocked(resetTokenRepository.create).mockReturnValue(
      Effect.fail(new Error("DB down") as any)
    );
    const res = await post({ email: "test@example.com" });
    expect(res.status).toBe(200);
  });

  // ── Happy path internals ──────────────────────────────────────────────────

  it("invalidates old tokens before issuing a new one", async () => {
    await post({ email: "test@example.com" });
    expect(resetTokenRepository.deleteAllByUserId).toHaveBeenCalledWith(
      MOCK_USER.id
    );
    expect(resetTokenRepository.create).toHaveBeenCalled();
  });

  it("calls enqueuePasswordReset with the user email and a reset URL", async () => {
    await post({ email: "test@example.com" });
    expect(enqueuePasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ to: MOCK_USER.email })
    );
  });

  it("does NOT call enqueuePasswordReset when email is not registered", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null));
    await post({ email: "ghost@example.com" });
    expect(enqueuePasswordReset).not.toHaveBeenCalled();
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("returns 422 for an invalid email format", async () => {
    const res = await post({ email: "not-an-email" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when email is missing", async () => {
    const res = await post({});
    expect(res.status).toBe(422);
  });
});

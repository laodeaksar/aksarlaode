import { Effect } from "effect";

import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeAuditLog } from "@/lib/audit-log";
import { logoutHandler } from "@/handlers/logout";
import { sessionRepository } from "@/repository/session.repository";

import { MOCK_TOKENS, MOCK_USER } from "../fixtures";

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { deleteByToken: vi.fn() },
}));
vi.mock("@/lib/audit-log", () => ({
  writeAuditLog: vi.fn(),
}));

const app = new Elysia().post("/logout", logoutHandler);

function post(cookie?: string, userId?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  if (userId) headers["x-user-id"] = userId;
  return app.handle(
    new Request("http://localhost/logout", {
      method: "POST",
      headers,
    })
  );
}

describe("logoutHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionRepository.deleteByToken).mockReturnValue(
      Effect.succeed({} as any)
    );
  });

  it("returns 200 with logout message", async () => {
    const res = await post();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toContain("Logged out");
  });

  it("clears the ec_refresh cookie", async () => {
    const res = await post();
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("clears cookie with Path=/auth so it overrides the cookie set at login", async () => {
    const res = await post();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("Path=/auth");
    expect(cookie).not.toContain("Path=/auth/refresh");
  });

  it("revokes the session from DB when cookie is present", async () => {
    await post(`ec_refresh=${encodeURIComponent(MOCK_TOKENS.refreshToken)}`);
    expect(sessionRepository.deleteByToken).toHaveBeenCalled();
  });

  it("does not crash when no cookie is present", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(sessionRepository.deleteByToken).not.toHaveBeenCalled();
  });

  it("emits LOGOUT audit event when x-user-id is present", async () => {
    await post(undefined, MOCK_USER.id);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "LOGOUT", actorId: MOCK_USER.id })
    );
  });

  it("does not emit LOGOUT audit event when x-user-id is missing", async () => {
    await post();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});

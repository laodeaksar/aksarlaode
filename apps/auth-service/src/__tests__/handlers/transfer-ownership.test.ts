import { Effect } from "effect";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_ADMIN, MOCK_OWNER, MOCK_USER } from "@/__tests__/fixtures";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindById = vi.fn();
const mockTransferOwnership = vi.fn();
const mockVerifyPassword = vi.fn();

const mockDeleteAllSessions = vi.fn();

vi.mock("@/repository/user.repository", () => ({
  userRepository: {
    findById: (...a: unknown[]) => mockFindById(...a),
    transferOwnership: (...a: unknown[]) => mockTransferOwnership(...a),
  },
}));

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: {
    deleteAllByUserId: (...a: unknown[]) => mockDeleteAllSessions(...a),
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: (...a: unknown[]) => mockVerifyPassword(...a),
}));

// Import AFTER mocks are in place
const { transferOwnershipHandler } =
  await import("@/handlers/transfer-ownership");

// ── Context factory ───────────────────────────────────────────────────────────

type CtxOverrides = {
  body?: Record<string, string>;
  headers?: Record<string, string | undefined>;
};

const makeCtx = ({ body = {}, headers = {} }: CtxOverrides = {}) => ({
  body: {
    targetUserId: MOCK_ADMIN.id,
    currentPassword: "CorrectPassword1!",
    ...body,
  },
  headers: {
    "x-user-id": MOCK_OWNER.id,
    "x-user-role": "OWNER",
    ...headers,
  },
  set: { status: 200 as number, headers: {} as Record<string, string> },
  query: {},
  params: {},
  request: new Request("http://localhost/auth/owner/transfer"),
  store: {},
});

// ── Default happy-path mocks ──────────────────────────────────────────────────

const TRANSFER_RESULT = {
  newOwner: { ...MOCK_ADMIN, role: "OWNER" },
  prevOwner: { ...MOCK_OWNER, role: "ADMIN" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockImplementation((id: string) =>
    id === MOCK_OWNER.id
      ? Effect.succeed(MOCK_OWNER)
      : Effect.succeed(MOCK_ADMIN)
  );
  mockVerifyPassword.mockReturnValue(Effect.succeed(true));
  mockTransferOwnership.mockReturnValue(Effect.succeed(TRANSFER_RESULT));
  // Handler invalidates sessions for both actors after a successful transfer
  mockDeleteAllSessions.mockReturnValue(Effect.succeed(undefined));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("transferOwnershipHandler — authorization", () => {
  it("returns 403 when x-user-role is ADMIN", async () => {
    const ctx = makeCtx({
      headers: { "x-user-id": MOCK_ADMIN.id, "x-user-role": "ADMIN" },
    });
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(403);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("returns 403 when x-user-role is CUSTOMER", async () => {
    const ctx = makeCtx({
      headers: { "x-user-id": MOCK_USER.id, "x-user-role": "CUSTOMER" },
    });
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(403);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("returns 403 when x-user-id is missing", async () => {
    const ctx = makeCtx({
      headers: { "x-user-id": undefined, "x-user-role": "OWNER" },
    });
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(403);
  });

  it("proceeds when caller is OWNER", async () => {
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(200);
    expect(res).toHaveProperty("newOwner");
  });
});

describe("transferOwnershipHandler — self-transfer guard", () => {
  it("returns 422 when targetUserId equals the caller's own id", async () => {
    const ctx = makeCtx({
      body: { targetUserId: MOCK_OWNER.id, currentPassword: "pw" },
    });
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(422);
    expect(res.code).toBe("INVALID_TARGET");
  });
});

describe("transferOwnershipHandler — password re-auth guard", () => {
  it("returns 401 when actor is not found in DB", async () => {
    mockFindById.mockImplementation(() => Effect.succeed(null));
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(401);
    expect(res.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 when password is wrong", async () => {
    mockVerifyPassword.mockReturnValue(Effect.succeed(false));
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(401);
    expect(res.code).toBe("INVALID_CREDENTIALS");
  });

  it("does not call transferOwnership when password fails", async () => {
    mockVerifyPassword.mockReturnValue(Effect.succeed(false));
    await transferOwnershipHandler(makeCtx() as any);
    expect(mockTransferOwnership).not.toHaveBeenCalled();
  });
});

describe("transferOwnershipHandler — target user validation", () => {
  it("returns 404 when target user does not exist", async () => {
    mockFindById.mockImplementation(
      (id: string) =>
        id === MOCK_OWNER.id ? Effect.succeed(MOCK_OWNER) : Effect.succeed(null) // target not found
    );
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(404);
    expect(res.code).toBe("USER_NOT_FOUND");
  });
});

describe("transferOwnershipHandler — successful transfer", () => {
  it("returns shaped newOwner and prevOwner", async () => {
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(res.newOwner.id).toBe(MOCK_ADMIN.id);
    expect(res.newOwner.role).toBe("OWNER");
    expect(res.prevOwner.id).toBe(MOCK_OWNER.id);
    expect(res.prevOwner.role).toBe("ADMIN");
  });

  it("includes a re-login reminder in the response message", async () => {
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(typeof res.message).toBe("string");
    expect(res.message.toLowerCase()).toContain("re-login");
  });

  it("calls transferOwnership with correct actor and target ids", async () => {
    const ctx = makeCtx();
    await transferOwnershipHandler(ctx as any);
    expect(mockTransferOwnership).toHaveBeenCalledWith(
      MOCK_OWNER.id,
      MOCK_ADMIN.id
    );
  });
});

describe("transferOwnershipHandler — DB failure handling", () => {
  it("returns 500 when transferOwnership throws", async () => {
    mockTransferOwnership.mockReturnValue(Effect.fail(new Error("db down")));
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(ctx.set.status).toBe(500);
    expect(res.error).toBe("Failed to transfer ownership");
  });

  it("does not expose internal error details on DB failure", async () => {
    mockTransferOwnership.mockReturnValue(
      Effect.fail(new Error("topology destroyed: replica set"))
    );
    const ctx = makeCtx();
    const res = (await transferOwnershipHandler(ctx as any)) as any;
    expect(JSON.stringify(res)).not.toContain("topology destroyed");
  });
});

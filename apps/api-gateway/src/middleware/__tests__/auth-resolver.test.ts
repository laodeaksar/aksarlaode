import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import { Hono } from "hono";

import type { AppEnv } from "@/types/context";

// ── Mocks ─────────────────────────────────────────────────────────────────────

mock.module("@repo/env/gateway", () => ({
  env: {
    AUTH_SERVICE_URL: "http://auth-service-test",
    INTERNAL_SERVICE_TOKEN: "test-internal-token-32-chars-long!!",
    JWT_ACCESS_PUBLIC_KEY: "dummy",
    MIDTRANS_SERVER_KEY: "dummy",
    REDIS_HOST: "localhost",
    REDIS_PORT: 6379,
    REDIS_PASSWORD: "",
  },
}));

// Controlled verifyJwt — swap return value per-test
const mockVerifyJwt = mock((_token: string) =>
  Effect.succeed({
    id: "user-1",
    role: "CUSTOMER" as const,
    sessionId: "session-1",
    email: "user@example.com",
  })
);

mock.module("@/lib/jwt", () => ({ verifyJwt: mockVerifyJwt }));

// Controlled verifyHmac — swap return value per-test
const mockVerifyHmac = mock((_body: string, _sig: string) =>
  Effect.succeed(undefined)
);

mock.module("@/lib/hmac", () => ({ verifyHmac: mockVerifyHmac }));

// Fixed PUBLIC_ROUTES + WEBHOOK_ROUTES used across all tests
mock.module("@/lib/route-permissions", () => ({
  PUBLIC_ROUTES: [
    { path: "/health", method: "*" },
    { path: "/auth/login", method: "POST" },
    { path: "/products", method: "GET" },
  ],
  WEBHOOK_ROUTES: ["/webhooks"],
}));

// Circuit breaker — always allow by default; tests override as needed
const mockBreakerAllow = mock(() => true);
const mockBreakerSuccess = mock(() => undefined);
const mockBreakerFailure = mock(() => undefined);

mock.module("@/lib/circuit-breaker", () => ({
  getBreaker: () => ({
    allow: mockBreakerAllow,
    success: mockBreakerSuccess,
    failure: mockBreakerFailure,
  }),
}));

// global fetch mock — default: session valid
const mockFetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify({ valid: true }), { status: 200 }))
);
global.fetch = mockFetch as typeof fetch;

// Dynamic import AFTER mocks
const { authResolver } = await import("../auth-resolver");

// ── Test app factory ──────────────────────────────────────────────────────────
function makeApp() {
  const app = new Hono<AppEnv>();

  // Seed required context vars that upstream middleware normally sets
  app.use("*", async (c, next) => {
    c.set("requestId", "test-rid");
    c.set("abortSignal", new AbortController().signal);
    await next();
  });

  app.use("*", authResolver);

  // Protected routes
  app.get("/protected", (c) => c.json({ ok: true }));
  app.post("/orders", (c) => c.json({ created: true }));

  // Public routes
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.post("/auth/login", (c) => c.json({ token: "abc" }));
  app.get("/products", (c) => c.json({ items: [] }));

  // Webhook route
  app.post("/webhooks/midtrans", (c) => c.json({ received: true }));

  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(path: string, method = "GET", headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { method, headers });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("authResolver — public routes", () => {
  beforeEach(() => {
    mockVerifyJwt.mockReset();
    mockFetch.mockReset();
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    );
  });

  test("passes GET /health through without JWT check", async () => {
    const app = makeApp();
    const res = await app.fetch(makeReq("/health"));
    expect(res.status).toBe(200);
    expect(mockVerifyJwt.mock.calls.length).toBe(0);
  });

  test("passes POST /auth/login through without JWT check", async () => {
    const app = makeApp();
    const res = await app.fetch(makeReq("/auth/login", "POST"));
    expect(res.status).toBe(200);
    expect(mockVerifyJwt.mock.calls.length).toBe(0);
  });

  test("passes GET /products through without JWT check", async () => {
    const app = makeApp();
    const res = await app.fetch(makeReq("/products"));
    expect(res.status).toBe(200);
    expect(mockVerifyJwt.mock.calls.length).toBe(0);
  });
});

describe("authResolver — protected routes", () => {
  beforeEach(() => {
    mockVerifyJwt.mockReset();
    mockFetch.mockReset();
    mockBreakerAllow.mockReset();
    mockBreakerAllow.mockImplementation(() => true);
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    );
    // Default: valid JWT
    mockVerifyJwt.mockImplementation((_t: string) =>
      Effect.succeed({
        id: "user-1",
        role: "CUSTOMER" as const,
        sessionId: "session-1",
      })
    );
  });

  test("returns 401 when Authorization header is absent", async () => {
    const app = makeApp();
    const res = await app.fetch(makeReq("/protected"));
    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockVerifyJwt.mock.calls.length).toBe(0);
  });

  test("returns 401 when Authorization header is malformed (no Bearer prefix)", async () => {
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Token abc123" })
    );
    expect(res.status).toBe(401);
  });

  test("returns 401 when verifyJwt reports TokenInvalidError", async () => {
    mockVerifyJwt.mockImplementation(() =>
      Effect.fail({ _tag: "TokenInvalidError", reason: "bad_signature" })
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer bad-token" })
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 with TOKEN_EXPIRED code when verifyJwt reports TokenExpiredError", async () => {
    mockVerifyJwt.mockImplementation(() =>
      Effect.fail({ _tag: "TokenExpiredError" })
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer expired-token" })
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("TOKEN_EXPIRED");
  });

  test("passes through to next middleware on valid JWT", async () => {
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    expect(res.status).toBe(200);
  });
});

describe("authResolver — session denylist check (C-13)", () => {
  beforeEach(() => {
    mockVerifyJwt.mockReset();
    mockFetch.mockReset();
    mockBreakerAllow.mockReset();
    mockBreakerSuccess.mockReset();
    mockBreakerFailure.mockReset();
    mockBreakerAllow.mockImplementation(() => true);
    mockVerifyJwt.mockImplementation((_t: string) =>
      Effect.succeed({
        id: "user-1",
        role: "CUSTOMER" as const,
        sessionId: "session-abc",
      })
    );
  });

  test("allows request when auth-service confirms session is valid (200)", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    expect(res.status).toBe(200);
    expect(mockBreakerSuccess.mock.calls.length).toBeGreaterThan(0);
  });

  test("returns 401 when auth-service says session is revoked (401)", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 401 }))
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    // 401 from auth-service is a legitimate response, counts as success for circuit breaker
    expect(mockBreakerSuccess.mock.calls.length).toBeGreaterThan(0);
  });

  test("returns 401 when auth-service says session is revoked (403)", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 403 }))
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    expect(res.status).toBe(401);
  });

  test("fails open when auth-service fetch throws (network error)", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("ECONNREFUSED")));
    const app = makeApp();
    // Should still get 200 — fail-open policy
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    expect(res.status).toBe(200);
    expect(mockBreakerFailure.mock.calls.length).toBeGreaterThan(0);
  });

  test("skips denylist check when circuit breaker is OPEN (fail-open)", async () => {
    mockBreakerAllow.mockImplementation(() => false); // breaker is OPEN
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    // Passes through — fail-open when circuit is OPEN
    expect(res.status).toBe(200);
    expect(mockFetch.mock.calls.length).toBe(0); // no fetch attempt
  });

  test("skips denylist check when JWT has no sessionId", async () => {
    mockVerifyJwt.mockImplementation(() =>
      Effect.succeed({
        id: "user-1",
        role: "CUSTOMER" as const,
        sessionId: "", // empty sessionId — no denylist call
      })
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/protected", "GET", { Authorization: "Bearer valid-token" })
    );
    expect(res.status).toBe(200);
    expect(mockFetch.mock.calls.length).toBe(0);
  });
});

describe("authResolver — webhook routes", () => {
  beforeEach(() => {
    mockVerifyHmac.mockReset();
    mockVerifyJwt.mockReset();
    // Default: HMAC valid
    mockVerifyHmac.mockImplementation(() => Effect.succeed(undefined));
  });

  test("accepts POST /webhooks/midtrans with valid HMAC signature", async () => {
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/webhooks/midtrans", "POST", {
        "x-midtrans-signature": "valid-sig",
        "content-type": "application/json",
      })
    );
    expect(res.status).toBe(200);
    expect(mockVerifyJwt.mock.calls.length).toBe(0); // no JWT check for webhooks
  });

  test("returns 401 when HMAC signature is invalid", async () => {
    mockVerifyHmac.mockImplementation(() =>
      Effect.fail({ _tag: "HmacInvalidError", reason: "signature_mismatch" })
    );
    const app = makeApp();
    const res = await app.fetch(
      makeReq("/webhooks/midtrans", "POST", {
        "x-midtrans-signature": "bad-sig",
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

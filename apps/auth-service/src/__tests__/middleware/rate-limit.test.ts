import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redis } from "@/lib/redis";
import {
  changePasswordRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter,
} from "@/middleware/rate-limit";

/**
 * The rate limiter implementation uses redis.eval() to run an atomic Lua
 * sliding-window script. Previous versions of this test mocked redis.incr /
 * redis.expire / redis.ttl — methods that the implementation never calls —
 * which meant the test suite passed while providing zero coverage of the actual
 * rate-limiting logic.
 *
 * This file mocks redis.eval() correctly and asserts on the values the
 * Lua script returns:
 *   [1, 0]       → request allowed
 *   [0, retryMs] → request blocked; Retry-After = ceil(retryMs / 1000) seconds
 *
 * On a Redis error, the middleware must fail-closed (503) so that an outage
 * cannot be exploited to bypass brute-force protection on auth endpoints.
 */

vi.mock("@/lib/redis", () => ({
  redis: {
    eval: vi.fn(),
  },
}));

type AnyLimiter = typeof loginRateLimiter;

function makeApp(limiter: AnyLimiter) {
  return new Elysia().post("/test", () => ({ ok: true }), {
    beforeHandle: limiter,
  });
}

function post(app: Elysia, ip = "1.2.3.4") {
  return app.handle(
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "x-real-ip": ip },
    })
  );
}

/** Mock the Lua script returning "allowed" — [1, 0]. */
function mockAllowed() {
  vi.mocked(redis.eval).mockResolvedValue([1, 0]);
}

/** Mock the Lua script returning "blocked" with a retry hint in milliseconds. */
function mockBlocked(retryMs = 60_000) {
  vi.mocked(redis.eval).mockResolvedValue([0, retryMs]);
}

/** Simulate Redis being unavailable. */
function mockRedisDown(message = "ECONNREFUSED") {
  vi.mocked(redis.eval).mockRejectedValue(new Error(message));
}

// ── changePasswordRateLimiter (5 req / 15 min) ──────────────────────────────

describe("changePasswordRateLimiter", () => {
  const app = makeApp(changePasswordRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("allows request when under limit", async () => {
    mockAllowed();
    const res = await post(app);
    expect(res.status).toBe(200);
  });

  it("returns 429 when Lua script says blocked", async () => {
    mockBlocked(45_000);
    const res = await post(app);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("includes X-RateLimit-Limit header on block", async () => {
    mockBlocked(30_000);
    const res = await post(app);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
  });
});

// ── resetPasswordRateLimiter (10 req / 60 min) ──────────────────────────────

describe("resetPasswordRateLimiter", () => {
  const app = makeApp(resetPasswordRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("allows request when under limit", async () => {
    mockAllowed();
    const res = await post(app);
    expect(res.status).toBe(200);
  });

  it("returns 429 when blocked", async () => {
    mockBlocked(120_000);
    const res = await post(app);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBe("120");
  });
});

// ── refreshRateLimiter (30 req / 15 min) ────────────────────────────────────

describe("refreshRateLimiter", () => {
  const app = makeApp(refreshRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("allows request when under limit", async () => {
    mockAllowed();
    const res = await post(app);
    expect(res.status).toBe(200);
  });

  it("returns 429 with correct Retry-After when blocked", async () => {
    mockBlocked(300_000);
    const res = await post(app);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBe("300");
  });
});

// ── loginRateLimiter (10 req / 15 min) ──────────────────────────────────────

describe("loginRateLimiter", () => {
  const app = makeApp(loginRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("allows request when under limit", async () => {
    mockAllowed();
    const res = await post(app);
    expect(res.status).toBe(200);
  });

  it("returns 429 when blocked", async () => {
    mockBlocked(900_000);
    const res = await post(app);
    expect(res.status).toBe(429);
  });
});

// ── Fail-closed when Redis is unavailable ────────────────────────────────────
//
// Auth endpoints are high-value brute-force targets. When Redis is unreachable
// the rate limiter MUST block (503), not silently allow. An outage that silently
// disables rate limiting would allow unlimited brute-force during the window.

describe("fail-closed when Redis is unavailable", () => {
  const app = makeApp(changePasswordRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("returns 503 when redis.eval throws", async () => {
    mockRedisDown("connection refused");
    const res = await post(app);
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("sets Retry-After to the window duration on Redis failure", async () => {
    mockRedisDown("ECONNREFUSED");
    const res = await post(app);
    // changePasswordRateLimiter window = 15 min = 900 s
    expect(res.headers.get("Retry-After")).toBe("900");
  });

  it("returns 503 for loginRateLimiter when Redis throws", async () => {
    const loginApp = makeApp(loginRateLimiter as AnyLimiter);
    mockRedisDown("timeout");
    const res = await post(loginApp);
    expect(res.status).toBe(503);
  });

  it("returns 503 for forgotPasswordRateLimiter when Redis throws", async () => {
    const fpApp = makeApp(forgotPasswordRateLimiter as AnyLimiter);
    mockRedisDown();
    const res = await post(fpApp);
    expect(res.status).toBe(503);
  });
});

// ── IP bucket isolation ──────────────────────────────────────────────────────
//
// Each (label, IP) pair must use a distinct Redis key so that traffic from
// different IPs does not share the same rate-limit window.

describe("IP bucket isolation", () => {
  const app = makeApp(changePasswordRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("uses x-real-ip as part of the Redis key", async () => {
    mockAllowed();
    await post(app, "10.0.0.1");
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String), // Lua script
      1, // number of KEYS
      expect.stringContaining("10.0.0.1"), // KEYS[1] contains the IP
      expect.any(String), // ARGV[1] now
      expect.any(String), // ARGV[2] window_start
      expect.any(String), // ARGV[3] max_requests
      expect.any(String), // ARGV[4] ttl_sec
      expect.any(String) // ARGV[5] member (crypto.randomUUID())
    );
  });

  it("uses different Redis keys for different IPs", async () => {
    mockAllowed();
    await post(app, "10.0.0.1");
    const firstKey = vi.mocked(redis.eval).mock.calls[0]?.[2] as string;

    vi.clearAllMocks();
    mockAllowed();
    await post(app, "10.0.0.2");
    const secondKey = vi.mocked(redis.eval).mock.calls[0]?.[2] as string;

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain("10.0.0.1");
    expect(secondKey).toContain("10.0.0.2");
  });
});

// ── registerRateLimiter (5 req / 60 min) ────────────────────────────────────

describe("registerRateLimiter", () => {
  const app = makeApp(registerRateLimiter as AnyLimiter);

  beforeEach(() => vi.clearAllMocks());

  it("allows request when under limit", async () => {
    mockAllowed();
    const res = await post(app);
    expect(res.status).toBe(200);
  });

  it("returns 429 when blocked", async () => {
    mockBlocked(3600_000);
    const res = await post(app);
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
  });
});

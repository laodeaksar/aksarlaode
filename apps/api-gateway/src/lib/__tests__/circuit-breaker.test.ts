import { beforeEach, describe, expect, mock, test } from "bun:test";

// ── Mock ioredis before any import that touches redis ─────────────────────────
const mockGet = mock(() => Promise.resolve(null));
const mockSet = mock(() => Promise.resolve("OK"));

mock.module("ioredis", () => ({
  default: class MockRedis {
    on() {
      return this;
    }
    get = mockGet;
    set = mockSet;
  },
}));

mock.module("@repo/env/gateway", () => ({
  env: {
    REDIS_URL: "redis://localhost:6379",
  },
}));

// Dynamic import AFTER mocks are registered
const { CircuitBreaker } = await import("../circuit-breaker");

// ── Helpers ───────────────────────────────────────────────────────────────────
let _seq = 0;
function uniqueName() {
  return `TEST_${++_seq}`;
}

function makeBreaker(
  overrides: {
    failureThreshold?: number;
    cooldownMs?: number;
    windowMs?: number;
  } = {}
) {
  return new CircuitBreaker(uniqueName(), {
    failureThreshold: 3,
    windowMs: 60_000,
    cooldownMs: 50, // short cooldown so OPEN→HALF_OPEN tests don't need to sleep long
    ...overrides,
  });
}

// ── State machine tests ───────────────────────────────────────────────────────
describe("CircuitBreaker — state machine", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockImplementation(() => Promise.resolve(null));
    mockSet.mockImplementation(() => Promise.resolve("OK"));
  });

  test("starts CLOSED and allows all requests", () => {
    const b = makeBreaker();
    expect(b.allow()).toBe(true);
    expect(b.allow()).toBe(true);
    expect(b.status().state).toBe("CLOSED");
  });

  test("trips to OPEN after reaching failure threshold", () => {
    const b = makeBreaker({ failureThreshold: 3 });
    b.failure();
    b.failure();
    expect(b.status().state).toBe("CLOSED"); // still CLOSED after 2 failures
    b.failure(); // 3rd failure hits threshold
    expect(b.status().state).toBe("OPEN");
  });

  test("blocks all requests when OPEN (before cooldown)", () => {
    const b = makeBreaker({ failureThreshold: 1 });
    b.failure();
    expect(b.status().state).toBe("OPEN");
    expect(b.allow()).toBe(false);
    expect(b.allow()).toBe(false);
  });

  test("transitions to HALF_OPEN after cooldown elapses", async () => {
    const b = makeBreaker({ failureThreshold: 1, cooldownMs: 20 });
    b.failure();
    expect(b.allow()).toBe(false); // OPEN — cooldown not elapsed
    await Bun.sleep(30); // wait past cooldown
    expect(b.allow()).toBe(true); // first probe allowed
    expect(b.status().state).toBe("HALF_OPEN");
  });

  test("HALF_OPEN blocks second concurrent probe", async () => {
    const b = makeBreaker({ failureThreshold: 1, cooldownMs: 20 });
    b.failure();
    await Bun.sleep(30);
    b.allow(); // first probe — transitions to HALF_OPEN
    expect(b.allow()).toBe(false); // second request blocked while probe in flight
  });

  test("success() from HALF_OPEN resets to CLOSED", async () => {
    const b = makeBreaker({ failureThreshold: 1, cooldownMs: 20 });
    b.failure();
    await Bun.sleep(30);
    b.allow(); // enter HALF_OPEN
    b.success();
    expect(b.status().state).toBe("CLOSED");
    expect(b.status().failures).toBe(0);
    expect(b.allow()).toBe(true);
  });

  test("failure() from HALF_OPEN re-opens the breaker", async () => {
    const b = makeBreaker({ failureThreshold: 1, cooldownMs: 20 });
    b.failure();
    await Bun.sleep(30);
    b.allow(); // enter HALF_OPEN
    b.failure(); // probe fails — back to OPEN
    expect(b.status().state).toBe("OPEN");
    expect(b.allow()).toBe(false);
  });

  test("success() while CLOSED is a no-op (stays CLOSED)", () => {
    const b = makeBreaker();
    b.success();
    expect(b.status().state).toBe("CLOSED");
  });

  test("status() reports name, state, failure count and config", () => {
    const b = makeBreaker({ failureThreshold: 5, cooldownMs: 30_000 });
    b.failure();
    b.failure();
    const s = b.status();
    expect(s.state).toBe("CLOSED");
    expect(s.failures).toBe(2);
    expect(s.config.failureThreshold).toBe(5);
    expect(s.config.cooldownMs).toBe(30_000);
  });

  test("old failures outside the window are pruned before threshold check", async () => {
    // windowMs = 50ms — failures older than 50ms don't count
    const b = makeBreaker({ failureThreshold: 3, windowMs: 50 });
    b.failure();
    b.failure();
    await Bun.sleep(60); // let the first two expire
    b.failure();
    b.failure();
    // only 2 fresh failures — should still be CLOSED
    expect(b.status().state).toBe("CLOSED");
    b.failure(); // 3rd fresh failure — trips
    expect(b.status().state).toBe("OPEN");
  });
});

// ── Redis persistence tests ───────────────────────────────────────────────────
describe("CircuitBreaker — Redis persistence", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockImplementation(() => Promise.resolve(null));
    mockSet.mockImplementation(() => Promise.resolve("OK"));
  });

  test("persist() fires a Redis SET on state transition (CLOSED→OPEN)", () => {
    const b = makeBreaker({ failureThreshold: 1 });
    const setCallsBefore = mockSet.mock.calls.length;
    b.failure(); // trips to OPEN
    // persist() is fire-and-forget, give event loop a tick
    expect(mockSet.mock.calls.length).toBeGreaterThan(setCallsBefore);
  });

  test("restoreFromRedis() sets OPEN state from snapshot", async () => {
    const snapshot = {
      state: "OPEN",
      lastOpenedAt: Date.now() - 5_000, // 5 s ago
      failures: [Date.now() - 1_000],
      savedAt: Date.now() - 5_000,
    };
    mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(snapshot)));

    const b = makeBreaker({ failureThreshold: 3, cooldownMs: 60_000 });
    await b.restoreFromRedis();
    expect(b.status().state).toBe("OPEN");
  });

  test("restoreFromRedis() discards snapshots older than 2× cooldown", async () => {
    const snapshot = {
      state: "OPEN",
      lastOpenedAt: Date.now() - 200_000,
      failures: [],
      savedAt: Date.now() - 200_000, // way older than 2 × 30s = 60s
    };
    mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(snapshot)));

    const b = makeBreaker({ failureThreshold: 3, cooldownMs: 30_000 });
    await b.restoreFromRedis();
    // stale snapshot is discarded — stays CLOSED
    expect(b.status().state).toBe("CLOSED");
  });

  test("restoreFromRedis() is a no-op when key does not exist", async () => {
    mockGet.mockImplementation(() => Promise.resolve(null));
    const b = makeBreaker();
    await b.restoreFromRedis();
    expect(b.status().state).toBe("CLOSED");
  });

  test("restoreFromRedis() fails silently when Redis throws", async () => {
    mockGet.mockImplementation(() => Promise.reject(new Error("Redis down")));
    const b = makeBreaker();
    await expect(b.restoreFromRedis()).resolves.toBeUndefined();
    expect(b.status().state).toBe("CLOSED");
  });
});

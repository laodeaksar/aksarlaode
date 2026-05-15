import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/redis", () => ({
  redis: { eval: vi.fn() },
}))

import { redis } from "@/lib/redis"
import { recordEmailAttempt } from "@/lib/account-lockout"

const EMAIL_HASH = "a".repeat(64)   // fake SHA-256 hex

function mockAllowed() {
  vi.mocked(redis.eval).mockResolvedValue([1, 0])
}

function mockBlocked(retryMs = 300_000) {
  vi.mocked(redis.eval).mockResolvedValue([0, retryMs])
}

describe("recordEmailAttempt", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns { locked: false } when Lua script allows the attempt", async () => {
    mockAllowed()
    const result = await recordEmailAttempt(EMAIL_HASH)
    expect(result.locked).toBe(false)
  })

  it("returns { locked: true, retryAfterSec } when Lua script blocks", async () => {
    mockBlocked(300_000)
    const result = await recordEmailAttempt(EMAIL_HASH)
    expect(result.locked).toBe(true)
    if (result.locked) {
      expect(result.retryAfterSec).toBe(300)   // 300_000 ms → 300 s
    }
  })

  it("calls redis.eval with a key that includes the emailHash", async () => {
    mockAllowed()
    await recordEmailAttempt(EMAIL_HASH)
    const key = vi.mocked(redis.eval).mock.calls[0]?.[2] as string
    expect(key).toContain(EMAIL_HASH)
    expect(key).toContain("lockout:email:")
  })

  it("calls redis.eval with correct sliding-window arguments", async () => {
    mockAllowed()
    await recordEmailAttempt(EMAIL_HASH)
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),              // Lua script
      1,                               // number of KEYS
      expect.stringContaining("lockout:email:"),  // KEYS[1]
      expect.any(String),              // ARGV[1] now (ms)
      expect.any(String),              // ARGV[2] window_start (ms)
      "20",                            // ARGV[3] max_requests
      "3600",                          // ARGV[4] ttl_sec (1 hour)
      expect.any(String),              // ARGV[5] member (uuid)
    )
  })

  it("fail-open: returns { locked: false } when Redis throws", async () => {
    vi.mocked(redis.eval).mockRejectedValue(new Error("ECONNREFUSED"))
    const result = await recordEmailAttempt(EMAIL_HASH)
    // Fail-open so a Redis outage does not lock everyone out
    expect(result.locked).toBe(false)
  })

  it("uses different Redis keys for different email hashes", async () => {
    mockAllowed()
    await recordEmailAttempt("a".repeat(64))
    const firstKey = vi.mocked(redis.eval).mock.calls[0]?.[2] as string

    vi.clearAllMocks()
    mockAllowed()
    await recordEmailAttempt("b".repeat(64))
    const secondKey = vi.mocked(redis.eval).mock.calls[0]?.[2] as string

    expect(firstKey).not.toBe(secondKey)
  })
})

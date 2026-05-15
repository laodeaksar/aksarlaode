import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"

vi.mock("@/lib/redis", () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl:  vi.fn(),
  },
}))

import { redis } from "@/lib/redis"
import {
  loginRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
  changePasswordRateLimiter,
  resetPasswordRateLimiter,
  refreshRateLimiter,
} from "@/middleware/rate-limit"

function makeApp(limiter: ReturnType<typeof loginRateLimiter> extends Promise<unknown> ? never : typeof loginRateLimiter) {
  return new Elysia()
    .post("/test", () => ({ ok: true }), { beforeHandle: limiter })
}

function post(app: Elysia, ip = "1.2.3.4") {
  return app.handle(new Request("http://localhost/test", {
    method:  "POST",
    headers: { "x-real-ip": ip },
  }))
}

// Helper — make Redis report `current` as the counter value
function mockCount(current: number, ttl = 60) {
  vi.mocked(redis.incr).mockResolvedValue(current)
  vi.mocked(redis.expire).mockResolvedValue(1)
  vi.mocked(redis.ttl).mockResolvedValue(ttl)
}

describe("rate-limit middleware — new limiters", () => {
  beforeEach(() => vi.clearAllMocks())

  // ── changePasswordRateLimiter (5 / 15 min) ─────────────────────────────────

  describe("changePasswordRateLimiter", () => {
    const app = makeApp(changePasswordRateLimiter as any)

    it("allows request when under limit", async () => {
      mockCount(1)
      const res = await post(app)
      expect(res.status).toBe(200)
    })

    it("allows request exactly at the limit (5th request)", async () => {
      mockCount(5)
      const res = await post(app)
      expect(res.status).toBe(200)
    })

    it("returns 429 when limit is exceeded (6th request)", async () => {
      mockCount(6, 45)
      const res  = await post(app)
      const body = await res.json()
      expect(res.status).toBe(429)
      expect(body.code).toBe("RATE_LIMITED")
      expect(res.headers.get("Retry-After")).toBe("45")
    })
  })

  // ── resetPasswordRateLimiter (10 / 60 min) ─────────────────────────────────

  describe("resetPasswordRateLimiter", () => {
    const app = makeApp(resetPasswordRateLimiter as any)

    it("allows request when under limit", async () => {
      mockCount(3)
      const res = await post(app)
      expect(res.status).toBe(200)
    })

    it("allows request exactly at the limit (10th request)", async () => {
      mockCount(10)
      const res = await post(app)
      expect(res.status).toBe(200)
    })

    it("returns 429 when limit is exceeded (11th request)", async () => {
      mockCount(11, 120)
      const res  = await post(app)
      const body = await res.json()
      expect(res.status).toBe(429)
      expect(body.code).toBe("RATE_LIMITED")
      expect(res.headers.get("Retry-After")).toBe("120")
    })
  })

  // ── refreshRateLimiter (30 / 15 min) ───────────────────────────────────────

  describe("refreshRateLimiter", () => {
    const app = makeApp(refreshRateLimiter as any)

    it("allows request when under limit", async () => {
      mockCount(10)
      const res = await post(app)
      expect(res.status).toBe(200)
    })

    it("allows request exactly at the limit (30th request)", async () => {
      mockCount(30)
      const res = await post(app)
      expect(res.status).toBe(200)
    })

    it("returns 429 when limit is exceeded (31st request)", async () => {
      mockCount(31, 300)
      const res  = await post(app)
      const body = await res.json()
      expect(res.status).toBe(429)
      expect(body.code).toBe("RATE_LIMITED")
      expect(res.headers.get("Retry-After")).toBe("300")
    })
  })

  // ── Fail-open behaviour (shared across all limiters) ──────────────────────

  describe("fail-open when Redis is unavailable", () => {
    const app = makeApp(changePasswordRateLimiter as any)

    it("allows the request through when Redis throws", async () => {
      vi.mocked(redis.incr).mockRejectedValue(new Error("connection refused"))
      const res = await post(app)
      expect(res.status).toBe(200)
    })
  })

  // ── IP isolation: different IPs have separate buckets ─────────────────────

  describe("IP bucket isolation", () => {
    const app = makeApp(changePasswordRateLimiter as any)

    it("uses x-real-ip as the rate-limit key", async () => {
      mockCount(6)
      await post(app, "10.0.0.1")
      expect(redis.incr).toHaveBeenCalledWith(
        expect.stringContaining("10.0.0.1")
      )
    })
  })
})

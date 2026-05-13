import { describe, it, expect, vi, afterEach } from "vitest"
import { Effect }                              from "effect"
import { issueTokenPair, verifyToken }         from "@/lib/token"

afterEach(() => { vi.useRealTimers() })

describe("issueTokenPair", () => {
  it("returns an accessToken and refreshToken", async () => {
    const { accessToken, refreshToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    expect(accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
  })

  it("embeds the correct sub and role in the accessToken", async () => {
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "ADMIN", "session-1")
    )
    const [, bodyB64] = accessToken.split(".")
    const payload     = JSON.parse(atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")))
    expect(payload.sub).toBe("user-1")
    expect(payload.role).toBe("ADMIN")
    expect(payload.sessionId).toBe("session-1")
  })

  it("embeds type:'refresh' in the refreshToken", async () => {
    const { refreshToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    const [, bodyB64] = refreshToken.split(".")
    const payload     = JSON.parse(atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/")))
    expect(payload.type).toBe("refresh")
  })
})

describe("verifyToken", () => {
  it("succeeds with a freshly issued token", async () => {
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    const payload = await Effect.runPromise(verifyToken(accessToken))
    expect(payload.sub).toBe("user-1")
    expect(payload.role).toBe("CUSTOMER")
  })

  it("fails when the token has an invalid format", async () => {
    const result = await Effect.runPromiseExit(verifyToken("not.a.jwt"))
    expect(result._tag).toBe("Failure")
  })

  it("fails when the signature is tampered", async () => {
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    const [h, p] = accessToken.split(".")
    const tampered = `${h}.${p}.invalidsignature`
    const result   = await Effect.runPromiseExit(verifyToken(tampered))
    expect(result._tag).toBe("Failure")
  })

  it("fails when the access token has expired", async () => {
    vi.useFakeTimers()
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    // Advance past 15-minute access token expiry
    vi.advanceTimersByTime(16 * 60 * 1000)
    const result = await Effect.runPromiseExit(verifyToken(accessToken))
    expect(result._tag).toBe("Failure")
  })
})

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
    expect(payload.type).toBe("access")
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
  it("succeeds with a freshly issued access token", async () => {
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    const payload = await Effect.runPromise(verifyToken(accessToken, "access"))
    expect(payload.sub).toBe("user-1")
    expect(payload.role).toBe("CUSTOMER")
  })

  it("succeeds with a freshly issued refresh token", async () => {
    const { refreshToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    const payload = await Effect.runPromise(verifyToken(refreshToken, "refresh"))
    expect(payload.sub).toBe("user-1")
    expect(payload.type).toBe("refresh")
  })

  it("fails when the token has an invalid format", async () => {
    const result = await Effect.runPromiseExit(verifyToken("not.a.jwt", "access"))
    expect(result._tag).toBe("Failure")
  })

  it("fails when the signature is tampered", async () => {
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    const [h, p] = accessToken.split(".")
    const tampered = `${h}.${p}.invalidsignature`
    const result   = await Effect.runPromiseExit(verifyToken(tampered, "access"))
    expect(result._tag).toBe("Failure")
  })

  it("fails when the access token has expired", async () => {
    vi.useFakeTimers()
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    // Advance past 15-minute access token expiry
    vi.advanceTimersByTime(16 * 60 * 1000)
    const result = await Effect.runPromiseExit(verifyToken(accessToken, "access"))
    expect(result._tag).toBe("Failure")
  })

  it("fails when a refresh token is presented as an access token", async () => {
    const { refreshToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    // Attempt to use the refresh token where an access token is expected
    const result = await Effect.runPromiseExit(verifyToken(refreshToken, "access"))
    expect(result._tag).toBe("Failure")
  })

  it("fails when an access token is presented as a refresh token", async () => {
    const { accessToken } = await Effect.runPromise(
      issueTokenPair("user-1", "CUSTOMER", "session-1")
    )
    // Attempt to use the access token where a refresh token is expected
    const result = await Effect.runPromiseExit(verifyToken(accessToken, "refresh"))
    expect(result._tag).toBe("Failure")
  })
})

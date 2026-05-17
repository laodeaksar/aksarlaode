import { refreshHandler } from "@/handlers/refresh"
import { sessionRepository } from "@/repository/session.repository"
import { userRepository } from "@/repository/user.repository"
import { Effect } from "effect"
import { Elysia } from "elysia"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { issueTokenPair, verifyToken } from "@/lib/token"

import { MOCK_SESSION, MOCK_TOKENS, MOCK_USER } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findById: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: {
    findByToken: vi.fn(),
    rotateSession: vi.fn(), // atomic rotation replaces separate delete + create
  },
}))
vi.mock("@/lib/token", () => ({
  verifyToken: vi.fn(),
  issueTokenPair: vi.fn(),
}))

const REFRESH_COOKIE = `ec_refresh=${encodeURIComponent(MOCK_TOKENS.refreshToken)}`

const app = new Elysia().post("/refresh", refreshHandler)

function post(cookie?: string) {
  return app.handle(
    new Request("http://localhost/refresh", {
      method: "POST",
      headers: cookie ? { cookie } : {},
    })
  )
}

describe("refreshHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockReturnValue(
      Effect.succeed({ sub: MOCK_USER.id, type: "refresh" })
    )
    vi.mocked(sessionRepository.findByToken).mockReturnValue(
      Effect.succeed(MOCK_SESSION)
    )
    vi.mocked(userRepository.findById).mockReturnValue(
      Effect.succeed(MOCK_USER)
    )
    vi.mocked(sessionRepository.rotateSession).mockReturnValue(
      Effect.succeed({} as any)
    )
    vi.mocked(issueTokenPair).mockReturnValue(Effect.succeed(MOCK_TOKENS))
  })

  it("returns 200 with new accessToken on valid refresh cookie", async () => {
    const res = await post(REFRESH_COOKIE)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.accessToken).toBe(MOCK_TOKENS.accessToken)
    expect(res.headers.get("set-cookie")).toContain("ec_refresh=")
  })

  it("rotated cookie uses Path=/auth so browser sends it to /auth/logout", async () => {
    const res = await post(REFRESH_COOKIE)
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("Path=/auth")
    expect(cookie).not.toContain("Path=/auth/refresh")
  })

  it("atomically rotates the session via rotateSession", async () => {
    await post(REFRESH_COOKIE)
    // Single call to rotateSession — not separate delete + create
    expect(sessionRepository.rotateSession).toHaveBeenCalledTimes(1)
    expect(sessionRepository.rotateSession).toHaveBeenCalledWith(
      expect.any(String), // old token hash
      expect.objectContaining({ userId: MOCK_USER.id })
    )
  })

  it("returns 401 when no cookie is present", async () => {
    const res = await post()
    expect(res.status).toBe(401)
  })

  it("returns 401 when token verification fails", async () => {
    vi.mocked(verifyToken).mockReturnValue(Effect.fail(new Error("bad") as any))
    const res = await post(REFRESH_COOKIE)
    expect(res.status).toBe(401)
  })

  it("returns 401 when session not found in DB", async () => {
    vi.mocked(sessionRepository.findByToken).mockReturnValue(
      Effect.succeed(null)
    )
    const res = await post(REFRESH_COOKIE)
    expect(res.status).toBe(401)
  })

  it("returns 401 when session is expired", async () => {
    vi.mocked(sessionRepository.findByToken).mockReturnValue(
      Effect.succeed({ ...MOCK_SESSION, expiresAt: new Date("2000-01-01") })
    )
    const res = await post(REFRESH_COOKIE)
    expect(res.status).toBe(401)
  })

  it("returns 401 when rotateSession fails (keeps client safe — no orphaned cookie)", async () => {
    vi.mocked(sessionRepository.rotateSession).mockReturnValue(
      Effect.fail(new Error("DB down") as any)
    )
    const res = await post(REFRESH_COOKIE)
    expect(res.status).toBe(401)
  })
})

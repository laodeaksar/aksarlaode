import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono }   from "hono"
import { Effect } from "effect"
import { MOCK_USER, MOCK_SESSION, MOCK_TOKENS } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findById: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { findByToken: vi.fn(), deleteByToken: vi.fn(), create: vi.fn() },
}))
vi.mock("@/lib/token", () => ({
  verifyToken:    vi.fn(),
  issueTokenPair: vi.fn(),
}))

import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { verifyToken, issueTokenPair } from "@/lib/token"
import { refreshHandler }    from "@/handlers/refresh"

const REFRESH_COOKIE = `ec_refresh=${encodeURIComponent(MOCK_TOKENS.refreshToken)}`

const app = new Hono()
app.post("/refresh", refreshHandler)

function post(cookie?: string) {
  return app.request("/refresh", {
    method:  "POST",
    headers: cookie ? { cookie } : {},
  })
}

describe("refreshHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyToken).mockReturnValue(
      Effect.succeed({ sub: MOCK_USER.id, type: "refresh" })
    )
    vi.mocked(sessionRepository.findByToken).mockReturnValue(Effect.succeed(MOCK_SESSION))
    vi.mocked(userRepository.findById).mockReturnValue(Effect.succeed(MOCK_USER))
    vi.mocked(sessionRepository.deleteByToken).mockReturnValue(Effect.succeed({} as any))
    vi.mocked(issueTokenPair).mockReturnValue(Effect.succeed(MOCK_TOKENS))
    vi.mocked(sessionRepository.create).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 200 with new accessToken on valid refresh cookie", async () => {
    const res  = await post(REFRESH_COOKIE)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.accessToken).toBe(MOCK_TOKENS.accessToken)
    expect(res.headers.get("set-cookie")).toContain("ec_refresh=")
  })

  it("rotates the session: deletes old, creates new", async () => {
    await post(REFRESH_COOKIE)
    expect(sessionRepository.deleteByToken).toHaveBeenCalled()
    expect(sessionRepository.create).toHaveBeenCalled()
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
    vi.mocked(sessionRepository.findByToken).mockReturnValue(Effect.succeed(null))
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
})

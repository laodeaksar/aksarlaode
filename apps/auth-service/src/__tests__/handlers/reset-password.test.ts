import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"
import { Effect } from "effect"
import { MOCK_USER, MOCK_RESET_TOKEN } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findById: vi.fn(), updatePasswordHash: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { deleteAllByUserId: vi.fn() },
}))
vi.mock("@/repository/reset-token.repository", () => ({
  resetTokenRepository: { findByToken: vi.fn(), deleteByToken: vi.fn() },
}))
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}))

import { userRepository }        from "@/repository/user.repository"
import { sessionRepository }     from "@/repository/session.repository"
import { resetTokenRepository }  from "@/repository/reset-token.repository"
import { hashPassword }          from "@/lib/password"
import { resetPasswordHandler }  from "@/handlers/reset-password"

const app = new Elysia().post("/reset-password", resetPasswordHandler)

function post(body: unknown) {
  return app.handle(new Request("http://localhost/reset-password", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  }))
}

const VALID_BODY = { token: MOCK_RESET_TOKEN.token, newPassword: "newSecret1!" }

describe("resetPasswordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(Effect.succeed(MOCK_RESET_TOKEN))
    vi.mocked(userRepository.findById).mockReturnValue(Effect.succeed(MOCK_USER))
    vi.mocked(hashPassword).mockReturnValue(Effect.succeed("new:hash"))
    vi.mocked(userRepository.updatePasswordHash).mockReturnValue(Effect.succeed({} as any))
    vi.mocked(resetTokenRepository.deleteByToken).mockReturnValue(Effect.succeed({} as any))
    vi.mocked(sessionRepository.deleteAllByUserId).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 200 and revokes all sessions on success", async () => {
    const res  = await post(VALID_BODY)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain("reset successful")
    expect(sessionRepository.deleteAllByUserId).toHaveBeenCalledWith(MOCK_USER.id)
  })

  it("consumes the token (one-time use)", async () => {
    await post(VALID_BODY)
    expect(resetTokenRepository.deleteByToken).toHaveBeenCalledWith(MOCK_RESET_TOKEN.token)
  })

  it("returns 401 when token does not exist in DB", async () => {
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(Effect.succeed(null))
    const res = await post(VALID_BODY)
    expect(res.status).toBe(401)
  })

  it("returns 410 when token is expired", async () => {
    vi.mocked(resetTokenRepository.findByToken).mockReturnValue(
      Effect.succeed({ ...MOCK_RESET_TOKEN, expiresAt: new Date("2000-01-01") })
    )
    const res = await post(VALID_BODY)
    expect(res.status).toBe(410)
  })

  it("returns 422 when newPassword is too short", async () => {
    const res = await post({ token: MOCK_RESET_TOKEN.token, newPassword: "short" })
    expect(res.status).toBe(422)
  })

  it("clears the refresh cookie", async () => {
    const res = await post(VALID_BODY)
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
  })
})

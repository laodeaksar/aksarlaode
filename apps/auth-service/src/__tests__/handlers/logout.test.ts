import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"
import { Effect } from "effect"
import { MOCK_TOKENS } from "../fixtures"

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { deleteByToken: vi.fn() },
}))

import { sessionRepository } from "@/repository/session.repository"
import { logoutHandler }     from "@/handlers/logout"

const app = new Elysia().post("/logout", logoutHandler)

function post(cookie?: string) {
  return app.handle(new Request("http://localhost/logout", {
    method:  "POST",
    headers: cookie ? { cookie } : {},
  }))
}

describe("logoutHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sessionRepository.deleteByToken).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 200 with logout message", async () => {
    const res  = await post()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain("Logged out")
  })

  it("clears the ec_refresh cookie", async () => {
    const res = await post()
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("revokes the session from DB when cookie is present", async () => {
    await post(`ec_refresh=${encodeURIComponent(MOCK_TOKENS.refreshToken)}`)
    expect(sessionRepository.deleteByToken).toHaveBeenCalled()
  })

  it("does not crash when no cookie is present", async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(sessionRepository.deleteByToken).not.toHaveBeenCalled()
  })
})

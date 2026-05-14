import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"
import { Effect } from "effect"
import { MOCK_USER } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findById: vi.fn(), updatePasswordHash: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { deleteAllByUserId: vi.fn() },
}))
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
  hashPassword:   vi.fn(),
}))

import { userRepository }           from "@/repository/user.repository"
import { sessionRepository }        from "@/repository/session.repository"
import { verifyPassword, hashPassword } from "@/lib/password"
import { changePasswordHandler }    from "@/handlers/change-password"

const app = new Elysia().post("/change-password", changePasswordHandler)

function post(body: unknown, userId = MOCK_USER.id) {
  return app.handle(new Request("http://localhost/change-password", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body:    JSON.stringify(body),
  }))
}

describe("changePasswordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.findById).mockReturnValue(Effect.succeed(MOCK_USER))
    vi.mocked(verifyPassword).mockReturnValue(Effect.succeed(true))
    vi.mocked(hashPassword).mockReturnValue(Effect.succeed("new:hash"))
    vi.mocked(userRepository.updatePasswordHash).mockReturnValue(Effect.succeed({} as any))
    vi.mocked(sessionRepository.deleteAllByUserId).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 200 and revokes all sessions on success", async () => {
    const res  = await post({ currentPassword: "oldPass1!", newPassword: "newPass1!" })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain("Password changed")
    expect(sessionRepository.deleteAllByUserId).toHaveBeenCalledWith(MOCK_USER.id)
  })

  it("clears the refresh cookie", async () => {
    const res = await post({ currentPassword: "oldPass1!", newPassword: "newPass1!" })
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("returns 401 when current password is wrong", async () => {
    vi.mocked(verifyPassword).mockReturnValue(Effect.succeed(false))
    const res = await post({ currentPassword: "wrong", newPassword: "newPass1!" })
    expect(res.status).toBe(401)
  })

  it("returns 422 when new password equals current password", async () => {
    const res = await post({ currentPassword: "samePass1!", newPassword: "samePass1!" })
    expect(res.status).toBe(422)
  })

  it("returns 422 when new password is too short", async () => {
    const res = await post({ currentPassword: "oldPass1!", newPassword: "short" })
    expect(res.status).toBe(422)
  })

  it("returns 401 when x-user-id header is missing", async () => {
    const res = await app.handle(new Request("http://localhost/change-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentPassword: "old", newPassword: "newPass1!" }),
    }))
    expect(res.status).toBe(401)
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"
import { Effect } from "effect"
import { MOCK_USER } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findByEmail: vi.fn() },
}))
vi.mock("@/repository/reset-token.repository", () => ({
  resetTokenRepository: { deleteAllByUserId: vi.fn(), create: vi.fn() },
}))

import { userRepository }        from "@/repository/user.repository"
import { resetTokenRepository }  from "@/repository/reset-token.repository"
import { forgotPasswordHandler } from "@/handlers/forgot-password"

const app = new Elysia().post("/forgot-password", forgotPasswordHandler)

function post(body: unknown) {
  return app.handle(new Request("http://localhost/forgot-password", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  }))
}

describe("forgotPasswordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(MOCK_USER))
    vi.mocked(resetTokenRepository.deleteAllByUserId).mockReturnValue(Effect.succeed({} as any))
    vi.mocked(resetTokenRepository.create).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 200 with a resetToken when email is found", async () => {
    const res  = await post({ email: "test@example.com" })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.resetToken).not.toBeNull()
    expect(typeof body.resetToken).toBe("string")
    expect(body.resetToken).toHaveLength(64)
  })

  it("returns 200 with null resetToken when email is NOT found (anti-enumeration)", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null))
    const res  = await post({ email: "ghost@example.com" })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.resetToken).toBeNull()
  })

  it("invalidates old tokens before issuing a new one", async () => {
    await post({ email: "test@example.com" })
    expect(resetTokenRepository.deleteAllByUserId).toHaveBeenCalledWith(MOCK_USER.id)
    expect(resetTokenRepository.create).toHaveBeenCalled()
  })

  it("returns 422 for an invalid email format", async () => {
    const res = await post({ email: "not-an-email" })
    expect(res.status).toBe(422)
  })

  it("returns 422 when email is missing", async () => {
    const res = await post({})
    expect(res.status).toBe(422)
  })
})

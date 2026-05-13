import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono }   from "hono"
import { Effect } from "effect"
import { MOCK_USER, MOCK_TOKENS } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findByEmail: vi.fn(), create: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { create: vi.fn() },
}))
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}))
vi.mock("@/lib/token", () => ({
  issueTokenPair: vi.fn(),
}))

import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { hashPassword }      from "@/lib/password"
import { issueTokenPair }    from "@/lib/token"
import { registerHandler }   from "@/handlers/register"

const app = new Hono()
app.post("/register", registerHandler)

function post(body: unknown) {
  return app.request("/register", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

describe("registerHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null))
    vi.mocked(hashPassword).mockReturnValue(Effect.succeed("hashed:password"))
    vi.mocked(userRepository.create).mockReturnValue(Effect.succeed(MOCK_USER))
    vi.mocked(issueTokenPair).mockReturnValue(Effect.succeed(MOCK_TOKENS))
    vi.mocked(sessionRepository.create).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 201 with accessToken on valid registration", async () => {
    const res  = await post({ email: "new@example.com", name: "New User", password: "password1" })
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.accessToken).toBe(MOCK_TOKENS.accessToken)
    expect(body.user.email).toBe(MOCK_USER.email)
    expect(res.headers.get("set-cookie")).toContain("ec_refresh=")
  })

  it("returns 409 when email already exists", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(MOCK_USER))
    const res  = await post({ email: "test@example.com", name: "Dup", password: "password1" })
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.field).toBe("email")
  })

  it("returns 422 when password is too short (< 8 chars)", async () => {
    const res = await post({ email: "new@example.com", name: "User", password: "short" })
    expect(res.status).toBe(422)
  })

  it("returns 422 when name is missing", async () => {
    const res = await post({ email: "new@example.com", password: "password1" })
    expect(res.status).toBe(422)
  })

  it("hashes the password before storing", async () => {
    await post({ email: "new@example.com", name: "User", password: "password1" })
    expect(hashPassword).toHaveBeenCalledWith("password1")
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hashed:password" })
    )
  })
})

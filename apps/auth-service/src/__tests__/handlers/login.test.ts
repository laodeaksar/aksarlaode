import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"
import { Effect } from "effect"
import { MOCK_USER, MOCK_TOKENS } from "../fixtures"
import { LoginBody } from "@/schemas"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { create: vi.fn() },
}))
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}))
vi.mock("@/lib/token", () => ({
  issueTokenPair: vi.fn(),
}))

import { userRepository }    from "@/repository/user.repository"
import { sessionRepository } from "@/repository/session.repository"
import { verifyPassword }    from "@/lib/password"
import { issueTokenPair }    from "@/lib/token"
import { loginHandler }      from "@/handlers/login"

const app = new Elysia().post("/login", loginHandler, { body: LoginBody })

function post(body: unknown) {
  return app.handle(new Request("http://localhost/login", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  }))
}

describe("loginHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(MOCK_USER))
    vi.mocked(verifyPassword).mockReturnValue(Effect.succeed(true))
    vi.mocked(issueTokenPair).mockReturnValue(Effect.succeed(MOCK_TOKENS))
    vi.mocked(sessionRepository.create).mockReturnValue(Effect.succeed({} as any))
  })

  it("returns 200 with accessToken on valid credentials", async () => {
    const res  = await post({ email: "test@example.com", password: "password1" })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.accessToken).toBe(MOCK_TOKENS.accessToken)
    expect(body.user.email).toBe(MOCK_USER.email)
    expect(res.headers.get("set-cookie")).toContain("ec_refresh=")
  })

  it("returns 401 when user does not exist", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null))
    const res = await post({ email: "ghost@example.com", password: "password1" })
    expect(res.status).toBe(401)
  })

  it("returns 401 when password is wrong", async () => {
    vi.mocked(verifyPassword).mockReturnValue(Effect.succeed(false))
    const res = await post({ email: "test@example.com", password: "wrong" })
    expect(res.status).toBe(401)
  })

  it("returns 422 when body is missing required fields", async () => {
    const res = await post({ email: "not-an-email" })
    expect(res.status).toBe(422)
  })

  it("returns 422 when body is empty", async () => {
    const res = await post({})
    expect(res.status).toBe(422)
  })
})

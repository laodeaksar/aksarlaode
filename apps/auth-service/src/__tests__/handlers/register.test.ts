import { registerHandler } from "@/handlers/register"
import { createUserWithSession } from "@/repository/auth.repository"
import { userRepository } from "@/repository/user.repository"
import { RegisterBody } from "@/schemas"
import { Effect } from "effect"
import { Elysia } from "elysia"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { hashPassword } from "@/lib/password"
import { issueTokenPair } from "@/lib/token"

import { MOCK_TOKENS, MOCK_USER } from "../fixtures"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findByEmail: vi.fn() },
}))
// createUserWithSession is the atomic transaction that replaces the old
// separate userRepository.create + sessionRepository.create calls.
vi.mock("@/repository/auth.repository", () => ({
  createUserWithSession: vi.fn(),
  consumeResetToken: vi.fn(),
}))
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}))
vi.mock("@/lib/token", () => ({
  issueTokenPair: vi.fn(),
}))
vi.mock("@/lib/audit-log", () => ({
  writeAuditLog: vi.fn(),
}))

const app = new Elysia().post("/register", registerHandler, {
  body: RegisterBody,
})

function post(body: unknown) {
  return app.handle(
    new Request("http://localhost/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("registerHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null))
    vi.mocked(hashPassword).mockReturnValue(Effect.succeed("hashed:password"))
    vi.mocked(issueTokenPair).mockReturnValue(Effect.succeed(MOCK_TOKENS))
    // createUserWithSession atomically creates user row + session row
    vi.mocked(createUserWithSession).mockReturnValue(
      Effect.succeed({ user: MOCK_USER, session: {} as any })
    )
  })

  it("returns 201 with accessToken on valid registration", async () => {
    const res = await post({
      email: "new@example.com",
      name: "New User",
      password: "password1",
    })
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.accessToken).toBe(MOCK_TOKENS.accessToken)
    expect(body.user.email).toBe(MOCK_USER.email)
    expect(res.headers.get("set-cookie")).toContain("ec_refresh=")
  })

  it("sets ec_refresh cookie with Path=/auth", async () => {
    const res = await post({
      email: "new@example.com",
      name: "New User",
      password: "password1",
    })
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("Path=/auth")
    expect(cookie).not.toContain("Path=/auth/refresh")
  })

  it("returns 409 when email already exists (fast-path check)", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(
      Effect.succeed(MOCK_USER)
    )
    const res = await post({
      email: "test@example.com",
      name: "Dup",
      password: "password1",
    })
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.field).toBe("email")
  })

  it("returns 422 when password is too short (< 8 chars)", async () => {
    const res = await post({
      email: "new@example.com",
      name: "User",
      password: "short",
    })
    expect(res.status).toBe(422)
  })

  it("returns 422 when name is missing", async () => {
    const res = await post({ email: "new@example.com", password: "password1" })
    expect(res.status).toBe(422)
  })

  it("hashes the password and passes it to createUserWithSession", async () => {
    await post({
      email: "new@example.com",
      name: "User",
      password: "password1",
    })
    expect(hashPassword).toHaveBeenCalledWith("password1")
    expect(createUserWithSession).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hashed:password" }),
      expect.any(Object)
    )
  })

  it("returns 409 on DB-level unique constraint violation (concurrent registration race)", async () => {
    const { ConflictError } = await import("@repo/common/errors")
    vi.mocked(createUserWithSession).mockReturnValue(
      Effect.fail(new ConflictError("email"))
    )
    // Make findByEmail say email is free so the race is on the DB insert
    vi.mocked(userRepository.findByEmail).mockReturnValue(Effect.succeed(null))
    const res = await post({
      email: "race@example.com",
      name: "Race User",
      password: "password1",
    })
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.field).toBe("email")
  })
})

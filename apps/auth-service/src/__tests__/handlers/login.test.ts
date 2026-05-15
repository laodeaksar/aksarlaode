import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia } from "elysia"
import { Effect } from "effect"
import { MOCK_USER, MOCK_TOKENS } from "../fixtures"
import { LoginBody } from "@/schemas"

vi.mock("@/repository/user.repository", () => ({
  userRepository: { findByEmail: vi.fn(), findById: vi.fn(), create: vi.fn(), updatePasswordHash: vi.fn() },
}))
vi.mock("@/repository/session.repository", () => ({
  sessionRepository: {
    create:               vi.fn(),
    countByUserId:        vi.fn(() => Effect.succeed(0)),
    deleteOldestByUserId: vi.fn(() => Effect.succeed(undefined)),
  },
}))
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
  hashPassword:   vi.fn(),
  needsRehash:    vi.fn(() => false),
}))
vi.mock("@/lib/token", () => ({
  issueTokenPair: vi.fn(),
}))
vi.mock("@/lib/audit-log", () => ({
  writeAuditLog: vi.fn(),
}))
// Per-email account lockout — default: allow all (unlocked)
vi.mock("@/lib/account-lockout", () => ({
  recordEmailAttempt: vi.fn(() => Promise.resolve({ locked: false })),
}))
// PII masking — return a deterministic value so assertions are stable
vi.mock("@/lib/pii", () => ({
  maskEmail: vi.fn((email: string) => `${email[0]}***@example.com`),
}))

import { userRepository }                            from "@/repository/user.repository"
import { sessionRepository }                         from "@/repository/session.repository"
import { verifyPassword, hashPassword, needsRehash } from "@/lib/password"
import { issueTokenPair }                            from "@/lib/token"
import { writeAuditLog }                             from "@/lib/audit-log"
import { recordEmailAttempt }                        from "@/lib/account-lockout"
import { loginHandler }                              from "@/handlers/login"

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
    vi.mocked(recordEmailAttempt).mockResolvedValue({ locked: false })
  })

  it("returns 200 with accessToken on valid credentials", async () => {
    const res  = await post({ email: "test@example.com", password: "password1" })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.accessToken).toBe(MOCK_TOKENS.accessToken)
    expect(body.user.email).toBe(MOCK_USER.email)
    expect(res.headers.get("set-cookie")).toContain("ec_refresh=")
  })

  it("sets ec_refresh cookie with Path=/auth so it is sent to logout and refresh", async () => {
    const res    = await post({ email: "test@example.com", password: "password1" })
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("Path=/auth")
    expect(cookie).not.toContain("Path=/auth/refresh")
  })

  it("calls recordEmailAttempt before any DB lookup", async () => {
    await post({ email: "test@example.com", password: "password1" })
    expect(recordEmailAttempt).toHaveBeenCalled()
  })

  it("returns 429 and skips DB lookup when email is locked out", async () => {
    vi.mocked(recordEmailAttempt).mockResolvedValue({ locked: true, retryAfterSec: 300 })
    const res  = await post({ email: "test@example.com", password: "password1" })
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(body.code).toBe("ACCOUNT_LOCKED")
    expect(res.headers.get("Retry-After")).toBe("300")
    expect(userRepository.findByEmail).not.toHaveBeenCalled()
  })

  it("emits LOGIN_SUCCESS audit event on successful login", async () => {
    await post({ email: "test@example.com", password: "password1" })
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "LOGIN_SUCCESS", actorId: MOCK_USER.id })
    )
  })

  it("does NOT include plaintext email in LOGIN_SUCCESS audit event", async () => {
    await post({ email: "test@example.com", password: "password1" })
    const successCall = vi.mocked(writeAuditLog).mock.calls.find(
      ([entry]) => entry.event === "LOGIN_SUCCESS"
    )
    expect(JSON.stringify(successCall)).not.toContain("test@example.com")
  })

  it("emits LOGIN_FAILED audit event with masked email on bad credentials", async () => {
    vi.mocked(verifyPassword).mockReturnValue(Effect.succeed(false))
    await post({ email: "test@example.com", password: "wrong" })
    const failCall = vi.mocked(writeAuditLog).mock.calls.find(
      ([entry]) => entry.event === "LOGIN_FAILED"
    )
    expect(failCall).toBeDefined()
    const meta = failCall?.[0].meta as Record<string, string>
    expect(meta["emailMask"]).toBeDefined()
    // Must not log the plaintext email
    expect(JSON.stringify(failCall)).not.toContain("test@example.com")
  })

  it("emits OWNER_LOGIN in addition to LOGIN_SUCCESS for OWNER role", async () => {
    vi.mocked(userRepository.findByEmail).mockReturnValue(
      Effect.succeed({ ...MOCK_USER, role: "OWNER" as const })
    )
    await post({ email: "test@example.com", password: "password1" })
    const calls = vi.mocked(writeAuditLog).mock.calls.map(c => c[0].event)
    expect(calls).toContain("LOGIN_SUCCESS")
    expect(calls).toContain("OWNER_LOGIN")
  })

  it("does not emit OWNER_LOGIN for non-OWNER users", async () => {
    await post({ email: "test@example.com", password: "password1" })
    const calls = vi.mocked(writeAuditLog).mock.calls.map(c => c[0].event)
    expect(calls).not.toContain("OWNER_LOGIN")
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

  it("transparently upgrades a legacy PBKDF2 hash to Argon2id on successful login", async () => {
    vi.mocked(needsRehash).mockReturnValue(true)
    vi.mocked(hashPassword).mockReturnValue(Effect.succeed("$argon2id$v=19$new-hash"))
    vi.mocked(userRepository.updatePasswordHash).mockReturnValue(Effect.succeed(undefined as any))

    const res = await post({ email: "test@example.com", password: "password1" })
    expect(res.status).toBe(200)
    expect(vi.mocked(hashPassword)).toHaveBeenCalledWith("password1")
    expect(vi.mocked(userRepository.updatePasswordHash)).toHaveBeenCalledWith(
      MOCK_USER.id,
      "$argon2id$v=19$new-hash"
    )
  })

  it("still returns 200 when the Argon2id upgrade fails (fail-open)", async () => {
    vi.mocked(needsRehash).mockReturnValue(true)
    vi.mocked(hashPassword).mockReturnValue(Effect.fail(new Error("hash error") as any))

    const res = await post({ email: "test@example.com", password: "password1" })
    expect(res.status).toBe(200)
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

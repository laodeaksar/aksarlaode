import { revokeSessionHandler } from "@/handlers/revoke-session"
import { sessionRepository } from "@/repository/session.repository"
import { Effect } from "effect"
import { Elysia } from "elysia"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { writeAuditLog } from "@/lib/audit-log"

import { MOCK_SESSION, MOCK_USER } from "../fixtures"

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: {
    findByIdAndUserId: vi.fn(),
    deleteByIdAndUserId: vi.fn(),
  },
}))
vi.mock("@/lib/audit-log", () => ({
  writeAuditLog: vi.fn(),
}))

const app = new Elysia().delete("/sessions/:id", revokeSessionHandler)

function del(sessionId: string, userId?: string) {
  return app.handle(
    new Request(`http://localhost/sessions/${sessionId}`, {
      method: "DELETE",
      headers: userId ? { "x-user-id": userId } : {},
    })
  )
}

describe("revokeSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sessionRepository.findByIdAndUserId).mockReturnValue(
      Effect.succeed(MOCK_SESSION)
    )
    vi.mocked(sessionRepository.deleteByIdAndUserId).mockReturnValue(
      Effect.succeed({} as any)
    )
  })

  it("returns 200 on successful revocation", async () => {
    const res = await del(MOCK_SESSION.id, MOCK_USER.id)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain("revoked")
  })

  it("emits SESSION_REVOKED audit event on success", async () => {
    await del(MOCK_SESSION.id, MOCK_USER.id)
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SESSION_REVOKED",
        actorId: MOCK_USER.id,
        meta: expect.objectContaining({ sessionId: MOCK_SESSION.id }),
      })
    )
  })

  it("does not emit audit event when session is not found", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockReturnValue(
      Effect.succeed(null)
    )
    await del("other-session", MOCK_USER.id)
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it("returns 404 when session does not belong to the user", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockReturnValue(
      Effect.succeed(null)
    )
    const res = await del("other-session", MOCK_USER.id)
    expect(res.status).toBe(404)
  })

  it("returns 401 when x-user-id is missing", async () => {
    const res = await del(MOCK_SESSION.id)
    expect(res.status).toBe(401)
  })

  it("verifies ownership before deleting — uses correct userId", async () => {
    await del(MOCK_SESSION.id, MOCK_USER.id)
    expect(sessionRepository.findByIdAndUserId).toHaveBeenCalledWith(
      MOCK_SESSION.id,
      MOCK_USER.id
    )
    expect(sessionRepository.deleteByIdAndUserId).toHaveBeenCalledWith(
      MOCK_SESSION.id,
      MOCK_USER.id
    )
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono }   from "hono"
import { Effect } from "effect"
import { MOCK_USER, MOCK_SESSION } from "../fixtures"

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: {
    findByIdAndUserId:   vi.fn(),
    deleteByIdAndUserId: vi.fn(),
  },
}))

import { sessionRepository }   from "@/repository/session.repository"
import { revokeSessionHandler } from "@/handlers/revoke-session"

const app = new Hono()
app.delete("/sessions/:id", revokeSessionHandler)

function del(sessionId: string, userId?: string) {
  return app.request(`/sessions/${sessionId}`, {
    method:  "DELETE",
    headers: userId ? { "x-user-id": userId } : {},
  })
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
    const res  = await del(MOCK_SESSION.id, MOCK_USER.id)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toContain("revoked")
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

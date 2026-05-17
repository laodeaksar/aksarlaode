import { listSessionsHandler } from "@/handlers/list-sessions"
import { sessionRepository } from "@/repository/session.repository"
import { SessionQuery } from "@/schemas"
import { Effect } from "effect"
import { Elysia } from "elysia"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MOCK_SESSION, MOCK_USER } from "../fixtures"

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: { findPageByUserId: vi.fn() },
}))

const app = new Elysia().get("/sessions", listSessionsHandler, {
  query: SessionQuery,
})

function get(userId?: string, query = "") {
  return app.handle(
    new Request(`http://localhost/sessions${query}`, {
      headers: userId ? { "x-user-id": userId } : {},
    })
  )
}

describe("listSessionsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sessionRepository.findPageByUserId).mockReturnValue(
      Effect.succeed({ items: [MOCK_SESSION], total: 1 })
    )
  })

  it("returns 200 with paginated sessions", async () => {
    const res = await get(MOCK_USER.id)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.meta.total).toBe(1)
    expect(body.meta.page).toBe(1)
  })

  it("does not expose the raw token in the response", async () => {
    const res = await get(MOCK_USER.id)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain("mock.refresh.token")
  })

  it("returns 401 when x-user-id is missing", async () => {
    const res = await get()
    expect(res.status).toBe(401)
  })

  it("passes correct limit and offset to the repository", async () => {
    vi.mocked(sessionRepository.findPageByUserId).mockReturnValue(
      Effect.succeed({ items: [], total: 25 })
    )

    await get(MOCK_USER.id, "?page=2&limit=10")

    expect(sessionRepository.findPageByUserId).toHaveBeenCalledWith(
      MOCK_USER.id,
      { limit: 10, offset: 10 }
    )
  })

  it("supports pagination via query params", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      ...MOCK_SESSION,
      id: `session-${i}`,
    }))
    vi.mocked(sessionRepository.findPageByUserId).mockReturnValue(
      Effect.succeed({ items, total: 25 })
    )

    const res = await get(MOCK_USER.id, "?page=2&limit=10")
    const body = await res.json()
    expect(body.data).toHaveLength(10)
    expect(body.meta.page).toBe(2)
    expect(body.meta.total).toBe(25)
    expect(body.meta.totalPages).toBe(3)
    expect(body.meta.hasNextPage).toBe(true)
    expect(body.meta.hasPrevPage).toBe(true)
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { MOCK_USER, MOCK_ADMIN, MOCK_OWNER } from "@/__tests__/fixtures"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindAll          = vi.fn()
const mockFindById         = vi.fn()
const mockUpdateRole       = vi.fn()
const mockDeleteById       = vi.fn()
const mockSoftDeleteById   = vi.fn()
const mockDeleteAllSessions = vi.fn()

vi.mock("@/repository/user.repository", () => ({
  userRepository: {
    findAll:        (...a: unknown[]) => mockFindAll(...a),
    findById:       (...a: unknown[]) => mockFindById(...a),
    updateRole:     (...a: unknown[]) => mockUpdateRole(...a),
    deleteById:     (...a: unknown[]) => mockDeleteById(...a),
    softDeleteById: (...a: unknown[]) => mockSoftDeleteById(...a),   // handler uses soft-delete
  },
}))

vi.mock("@/repository/session.repository", () => ({
  sessionRepository: {
    deleteAllByUserId: (...a: unknown[]) => mockDeleteAllSessions(...a),
  },
}))

const { adminListUsersHandler, adminUpdateUserRoleHandler, adminDeleteUserHandler } =
  await import("@/handlers/admin-users")

// ── Context factory ───────────────────────────────────────────────────────────

const makeCtx = (
  query:   Record<string, string>            = {},
  headers: Record<string, string | undefined> = {},
  body:    Record<string, string>            = {},
  params:  Record<string, string>            = {},
) => ({
  query,
  headers: { "x-user-id": MOCK_OWNER.id, "x-user-role": "OWNER", ...headers },
  body,
  params,
  set:     { status: 200 as number, headers: {} as Record<string, string> },
  request: new Request("http://localhost/admin/users"),
  store:   {},
})

const PAGE_RESULT = {
  items: [MOCK_USER, MOCK_ADMIN, MOCK_OWNER],
  total: 3, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindAll.mockReturnValue(Effect.succeed(PAGE_RESULT))
  mockFindById.mockReturnValue(Effect.succeed(MOCK_ADMIN))
  mockUpdateRole.mockReturnValue(Effect.succeed({ ...MOCK_ADMIN, role: "CUSTOMER" }))
  mockDeleteById.mockReturnValue(Effect.succeed(MOCK_ADMIN))
  mockSoftDeleteById.mockReturnValue(Effect.succeed(MOCK_ADMIN))
  mockDeleteAllSessions.mockReturnValue(Effect.succeed(undefined))
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /admin/users
// ═══════════════════════════════════════════════════════════════════════════════

describe("adminListUsersHandler — authorization", () => {
  it("returns 403 for CUSTOMER", async () => {
    const ctx = makeCtx({}, { "x-user-role": "CUSTOMER" })
    const res = await adminListUsersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("returns 403 when role header is absent", async () => {
    const ctx = makeCtx({}, { "x-user-role": undefined })
    const res = await adminListUsersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
  })

  it("proceeds for ADMIN", async () => {
    const ctx = makeCtx({}, { "x-user-id": MOCK_ADMIN.id, "x-user-role": "ADMIN" })
    const res = await adminListUsersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
    expect(res).toHaveProperty("items")
  })

  it("proceeds for OWNER", async () => {
    const res = await adminListUsersHandler(makeCtx() as any) as any
    expect(res).toHaveProperty("items")
  })
})

describe("adminListUsersHandler — passwordHash projection", () => {
  it("strips passwordHash from every item", async () => {
    const res = await adminListUsersHandler(makeCtx() as any) as any
    for (const item of res.items) expect(item).not.toHaveProperty("passwordHash")
  })

  it("converts Date fields to ISO strings", async () => {
    const res = await adminListUsersHandler(makeCtx() as any) as any
    expect(res.items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(res.items[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe("adminListUsersHandler — pagination", () => {
  it("clamps limit to 100", async () => {
    await adminListUsersHandler(makeCtx({ limit: "9999" }) as any)
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })

  it("clamps page to minimum 1", async () => {
    await adminListUsersHandler(makeCtx({ page: "-3" }) as any)
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
  })

  it("returns pagination envelope fields", async () => {
    const res = await adminListUsersHandler(makeCtx() as any) as any
    expect(res).toHaveProperty("total")
    expect(res).toHaveProperty("totalPages")
    expect(res).toHaveProperty("hasNext")
    expect(res).toHaveProperty("hasPrev")
  })
})

describe("adminListUsersHandler — role filter", () => {
  it("passes role filter to repository", async () => {
    await adminListUsersHandler(makeCtx({ role: "ADMIN" }) as any)
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }))
  })

  it("normalises role filter to uppercase", async () => {
    await adminListUsersHandler(makeCtx({ role: "admin" }) as any)
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ role: "ADMIN" }))
  })

  it("returns 422 for unknown role", async () => {
    const ctx = makeCtx({ role: "SUPERUSER" })
    const res = await adminListUsersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("INVALID_ROLE")
  })
})

describe("adminListUsersHandler — DB failure", () => {
  it("returns 500 when findAll fails", async () => {
    mockFindAll.mockReturnValue(Effect.fail(new Error("db down")))
    const ctx = makeCtx()
    const res = await adminListUsersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /admin/users/:id/role
// ═══════════════════════════════════════════════════════════════════════════════

describe("adminUpdateUserRoleHandler — authorization", () => {
  it("returns 403 for ADMIN", async () => {
    const ctx = makeCtx({}, { "x-user-id": MOCK_ADMIN.id, "x-user-role": "ADMIN" }, { role: "CUSTOMER" }, { id: MOCK_USER.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("proceeds for OWNER", async () => {
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
  })
})

describe("adminUpdateUserRoleHandler — guards", () => {
  it("returns 422 when assigning OWNER via this endpoint", async () => {
    const ctx = makeCtx({}, {}, { role: "OWNER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("USE_TRANSFER_ENDPOINT")
  })

  it("returns 422 when changing own role", async () => {
    const ctx = makeCtx({}, {}, { role: "ADMIN" }, { id: MOCK_OWNER.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("SELF_ROLE_CHANGE")
  })

  it("returns 403 when target is another OWNER (canManage guard)", async () => {
    mockFindById.mockReturnValue(Effect.succeed({ ...MOCK_OWNER, id: "other-owner" }))
    const ctx = makeCtx({}, {}, { role: "ADMIN" }, { id: "other-owner" })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("returns 404 when target user does not exist", async () => {
    mockFindById.mockReturnValue(Effect.succeed(null))
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: "ghost" })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(404)
    expect(res.code).toBe("USER_NOT_FOUND")
  })
})

describe("adminUpdateUserRoleHandler — response shape", () => {
  it("strips passwordHash", async () => {
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(res.user).not.toHaveProperty("passwordHash")
  })

  it("returns changed.from and changed.to", async () => {
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(res.changed.from).toBe("ADMIN")
    expect(res.changed.to).toBe("CUSTOMER")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /admin/users/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("adminDeleteUserHandler — authorization", () => {
  it("returns 403 for ADMIN — only OWNER can delete", async () => {
    const ctx = makeCtx({}, { "x-user-id": MOCK_ADMIN.id, "x-user-role": "ADMIN" }, {}, { id: MOCK_USER.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("returns 403 for CUSTOMER", async () => {
    const ctx = makeCtx({}, { "x-user-id": MOCK_USER.id, "x-user-role": "CUSTOMER" }, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
  })

  it("proceeds for OWNER", async () => {
    const ctx = makeCtx({}, {}, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
  })
})

describe("adminDeleteUserHandler — self-delete guard", () => {
  it("returns 422 when OWNER tries to delete themselves", async () => {
    const ctx = makeCtx({}, {}, {}, { id: MOCK_OWNER.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("SELF_DELETE")
  })
})

describe("adminDeleteUserHandler — OWNER protection", () => {
  it("returns 403 with OWNER_PROTECTED when target is an OWNER", async () => {
    mockFindById.mockReturnValue(Effect.succeed({ ...MOCK_OWNER, id: "other-owner-id" }))
    const ctx = makeCtx({}, {}, {}, { id: "other-owner-id" })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("OWNER_PROTECTED")
  })

  it("does not call softDeleteById when target is an OWNER", async () => {
    mockFindById.mockReturnValue(Effect.succeed({ ...MOCK_OWNER, id: "other-owner-id" }))
    await adminDeleteUserHandler(makeCtx({}, {}, {}, { id: "other-owner-id" }) as any)
    expect(mockSoftDeleteById).not.toHaveBeenCalled()
  })
})

describe("adminDeleteUserHandler — cascade session invalidation", () => {
  it("deletes all sessions before the user row", async () => {
    const order: string[] = []
    mockDeleteAllSessions.mockImplementation(() => { order.push("sessions"); return Effect.succeed(undefined) })
    mockSoftDeleteById.mockImplementation(() => { order.push("user"); return Effect.succeed(MOCK_ADMIN) })

    await adminDeleteUserHandler(makeCtx({}, {}, {}, { id: MOCK_ADMIN.id }) as any)

    expect(order).toEqual(["sessions", "user"])
  })

  it("aborts and returns 500 when session deletion fails — user row preserved", async () => {
    mockDeleteAllSessions.mockReturnValue(Effect.fail(new Error("redis down")))
    const ctx = makeCtx({}, {}, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(500)
    expect(mockSoftDeleteById).not.toHaveBeenCalled()
  })

  it("calls deleteAllByUserId with the correct targetId", async () => {
    await adminDeleteUserHandler(makeCtx({}, {}, {}, { id: MOCK_ADMIN.id }) as any)
    expect(mockDeleteAllSessions).toHaveBeenCalledWith(MOCK_ADMIN.id)
  })
})

describe("adminDeleteUserHandler — not found", () => {
  it("returns 404 when target user does not exist", async () => {
    mockFindById.mockReturnValue(Effect.succeed(null))
    const ctx = makeCtx({}, {}, {}, { id: "ghost" })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(404)
    expect(res.code).toBe("USER_NOT_FOUND")
  })
})

describe("adminDeleteUserHandler — response shape", () => {
  it("returns deleted user summary without passwordHash", async () => {
    const ctx = makeCtx({}, {}, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(res.deleted).not.toHaveProperty("passwordHash")
    expect(res.deleted.id).toBe(MOCK_ADMIN.id)
    expect(res.deleted.role).toBe(MOCK_ADMIN.role)
  })

  it("includes a message confirming session invalidation", async () => {
    const ctx = makeCtx({}, {}, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(typeof res.message).toBe("string")
    expect(res.message.toLowerCase()).toContain("sessions invalidated")
  })
})

describe("adminDeleteUserHandler — DB failure", () => {
  it("returns 500 when softDeleteById fails", async () => {
    mockSoftDeleteById.mockReturnValue(Effect.fail(new Error("db down")))
    const ctx = makeCtx({}, {}, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(ctx.set.status).toBe(500)
  })

  it("does not expose internal error details", async () => {
    mockSoftDeleteById.mockReturnValue(Effect.fail(new Error("foreign key violation on orders table")))
    const ctx = makeCtx({}, {}, {}, { id: MOCK_ADMIN.id })
    const res = await adminDeleteUserHandler(ctx as any) as any
    expect(JSON.stringify(res)).not.toContain("foreign key")
  })
})

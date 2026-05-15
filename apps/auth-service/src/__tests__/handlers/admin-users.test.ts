import { describe, it, expect, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { MOCK_USER, MOCK_ADMIN, MOCK_OWNER } from "@/__tests__/fixtures"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindAll  = vi.fn()
const mockFindById = vi.fn()
const mockUpdateRole = vi.fn()

vi.mock("@/repository/user.repository", () => ({
  userRepository: {
    findAll:    (...a: unknown[]) => mockFindAll(...a),
    findById:   (...a: unknown[]) => mockFindById(...a),
    updateRole: (...a: unknown[]) => mockUpdateRole(...a),
  },
}))

const { adminListUsersHandler, adminUpdateUserRoleHandler } =
  await import("@/handlers/admin-users")

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCtx = (
  query:   Record<string, string>   = {},
  headers: Record<string, string>   = {},
  body:    Record<string, string>   = {},
  params:  Record<string, string>   = {},
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
  items:      [MOCK_USER, MOCK_ADMIN, MOCK_OWNER],
  total:      3,
  page:       1,
  limit:      20,
  totalPages: 1,
  hasNext:    false,
  hasPrev:    false,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindAll.mockReturnValue(Effect.succeed(PAGE_RESULT))
  mockFindById.mockReturnValue(Effect.succeed(MOCK_ADMIN))
  mockUpdateRole.mockReturnValue(Effect.succeed({ ...MOCK_ADMIN, role: "CUSTOMER" }))
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
    const ctx = makeCtx({}, {})
    delete (ctx.headers as any)["x-user-role"]
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
    const ctx = makeCtx()
    const res = await adminListUsersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
    expect(res).toHaveProperty("items")
  })
})

describe("adminListUsersHandler — passwordHash projection", () => {
  it("strips passwordHash from every item", async () => {
    const ctx = makeCtx()
    const res = await adminListUsersHandler(ctx as any) as any
    for (const item of res.items) {
      expect(item).not.toHaveProperty("passwordHash")
    }
  })

  it("includes expected user fields", async () => {
    const ctx = makeCtx()
    const res = await adminListUsersHandler(ctx as any) as any
    const first = res.items[0]
    expect(first).toHaveProperty("id")
    expect(first).toHaveProperty("email")
    expect(first).toHaveProperty("name")
    expect(first).toHaveProperty("role")
    expect(first).toHaveProperty("createdAt")
    expect(first).toHaveProperty("updatedAt")
  })

  it("converts Date fields to ISO strings", async () => {
    const ctx = makeCtx()
    const res = await adminListUsersHandler(ctx as any) as any
    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    expect(res.items[0].createdAt).toMatch(ISO_RE)
    expect(res.items[0].updatedAt).toMatch(ISO_RE)
  })
})

describe("adminListUsersHandler — pagination", () => {
  it("returns pagination envelope", async () => {
    const ctx = makeCtx({ page: "2", limit: "10" })
    const res = await adminListUsersHandler(ctx as any) as any
    expect(res).toHaveProperty("total")
    expect(res).toHaveProperty("totalPages")
    expect(res).toHaveProperty("hasNext")
    expect(res).toHaveProperty("hasPrev")
  })

  it("clamps limit to 100 before querying", async () => {
    const ctx = makeCtx({ limit: "9999" })
    await adminListUsersHandler(ctx as any)
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    )
  })

  it("clamps page to minimum 1", async () => {
    const ctx = makeCtx({ page: "-3" })
    await adminListUsersHandler(ctx as any)
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    )
  })
})

describe("adminListUsersHandler — role filter", () => {
  it("passes role filter to repository", async () => {
    const ctx = makeCtx({ role: "ADMIN" })
    await adminListUsersHandler(ctx as any)
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" })
    )
  })

  it("normalises role filter to uppercase", async () => {
    const ctx = makeCtx({ role: "admin" })
    await adminListUsersHandler(ctx as any)
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" })
    )
  })

  it("returns 422 for unknown role filter", async () => {
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
  it("returns 403 for ADMIN — only OWNER can change roles", async () => {
    const ctx = makeCtx({}, { "x-user-id": MOCK_ADMIN.id, "x-user-role": "ADMIN" }, { role: "CUSTOMER" }, { id: MOCK_USER.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("returns 403 for CUSTOMER", async () => {
    const ctx = makeCtx({}, { "x-user-id": MOCK_USER.id, "x-user-role": "CUSTOMER" }, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
  })

  it("proceeds for OWNER", async () => {
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
  })
})

describe("adminUpdateUserRoleHandler — OWNER assignment guard", () => {
  it("returns 422 when trying to assign OWNER via this endpoint", async () => {
    const ctx = makeCtx({}, {}, { role: "OWNER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("USE_TRANSFER_ENDPOINT")
  })
})

describe("adminUpdateUserRoleHandler — self-change guard", () => {
  it("returns 422 when OWNER tries to change their own role", async () => {
    const ctx = makeCtx({}, {}, { role: "ADMIN" }, { id: MOCK_OWNER.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("SELF_ROLE_CHANGE")
  })
})

describe("adminUpdateUserRoleHandler — canManage row-level guard", () => {
  it("returns 403 when target is another OWNER", async () => {
    // findById returns another OWNER
    mockFindById.mockReturnValue(Effect.succeed({ ...MOCK_OWNER, id: "other-owner" }))
    const ctx = makeCtx({}, {}, { role: "ADMIN" }, { id: "other-owner" })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("allows OWNER to demote ADMIN to CUSTOMER", async () => {
    mockFindById.mockReturnValue(Effect.succeed(MOCK_ADMIN))
    mockUpdateRole.mockReturnValue(Effect.succeed({ ...MOCK_ADMIN, role: "CUSTOMER" }))
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
    expect(res.changed.from).toBe("ADMIN")
    expect(res.changed.to).toBe("CUSTOMER")
  })

  it("allows OWNER to promote CUSTOMER to ADMIN", async () => {
    mockFindById.mockReturnValue(Effect.succeed(MOCK_USER))
    mockUpdateRole.mockReturnValue(Effect.succeed({ ...MOCK_USER, role: "ADMIN" }))
    const ctx = makeCtx({}, {}, { role: "ADMIN" }, { id: MOCK_USER.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
    expect(res.changed.from).toBe("CUSTOMER")
    expect(res.changed.to).toBe("ADMIN")
  })
})

describe("adminUpdateUserRoleHandler — not found", () => {
  it("returns 404 when target user does not exist", async () => {
    mockFindById.mockReturnValue(Effect.succeed(null))
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: "ghost-id" })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(404)
    expect(res.code).toBe("USER_NOT_FOUND")
  })
})

describe("adminUpdateUserRoleHandler — response shape", () => {
  it("returns shaped user without passwordHash", async () => {
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(res.user).not.toHaveProperty("passwordHash")
    expect(res.user).toHaveProperty("id")
    expect(res.user).toHaveProperty("role")
  })

  it("returns changed.from and changed.to", async () => {
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(res).toHaveProperty("changed")
    expect(res.changed.from).toBeDefined()
    expect(res.changed.to).toBe("CUSTOMER")
  })
})

describe("adminUpdateUserRoleHandler — DB failure", () => {
  it("returns 500 when updateRole fails", async () => {
    mockUpdateRole.mockReturnValue(Effect.fail(new Error("db down")))
    const ctx = makeCtx({}, {}, { role: "CUSTOMER" }, { id: MOCK_ADMIN.id })
    const res = await adminUpdateUserRoleHandler(ctx as any) as any
    expect(ctx.set.status).toBe(500)
  })
})

/**
 * Integration tests for adminListOrdersHandler.
 *
 * The orderRepository is mocked at the module level so no MongoDB
 * connection is ever attempted. All other imports (Effect, shapeOrder)
 * are real — this validates that the handler correctly wires them together.
 */
import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Effect } from "effect"

// ── Raw Mongoose doc fixture ────────────────────────────────────────────────
// Mimics exactly what Mongoose returns from a .lean() query.

const now  = new Date("2024-05-13T10:00:00.000Z")
const paid = new Date("2024-05-13T10:05:00.000Z")

const RAW_DOC = {
  _id:  "664fabc0000000000000001",
  __v:  2,
  orderId:  "ORD-20240513-A3F9B2C1",
  userId:   "user-uuid-001",
  status:   "PAID",
  items: [
    {
      _id:         "664fabc0000000000000002",
      productId:   "prod-uuid-001",
      productName: "Sepatu Running",
      sku:         "SKU-RUN-001",
      imageUrl:    null,
      price:       350_000,
      quantity:    2,
      subtotal:    700_000,
    },
  ],
  shippingAddress: {
    _id:           "664fabc0000000000000003",
    recipientName: "Budi Santoso",
    phone:         "08123456789",
    street:        "Jl. Merdeka No. 1",
    city:          "Jakarta",
    province:      "DKI Jakarta",
    postalCode:    "10110",
    country:       "ID",
  },
  totalAmount:    700_000,
  shippingFee:    15_000,
  discountAmount: 0,
  grandTotal:     715_000,
  notes:          null,
  statusHistory: [
    { _id: "664fabc0000000000000004", status: "PENDING_PAYMENT", note: null, changedBy: "system",          timestamp: now  },
    // Admin-only annotation — must be stripped
    { _id: "664fabc0000000000000005", status: "__NOTE__",         note: "Dicurigai fraud",  changedBy: "admin-007", timestamp: now  },
    { _id: "664fabc0000000000000006", status: "PAID",             note: null, changedBy: "service:midtrans", timestamp: paid },
  ],
  createdAt:   now,
  updatedAt:   paid,
  paidAt:      paid,
  shippedAt:   null,
  deliveredAt: null,
  cancelledAt: null,
}

// ── Mutable closure — lets each test control what findAll returns ───────────
let mockFindAllImpl: (filters: unknown) => unknown = () =>
  Effect.succeed({
    items:      [RAW_DOC],
    total:      1,
    page:       1,
    limit:      20,
    totalPages: 1,
    hasNext:    false,
    hasPrev:    false,
  })

let capturedFilters: unknown = null

mock.module("@/repository/order.repository", () => ({
  orderRepository: {
    findAll: (filters: unknown) => {
      capturedFilters = filters
      return mockFindAllImpl(filters)
    },
  },
}))

// Import handler AFTER mock.module so the mock is in place
const { adminListOrdersHandler } = await import("@/handlers/admin-orders")

// ── Context factory ─────────────────────────────────────────────────────────
const makeCtx = (
  query:   Record<string, string> = {},
  headers: Record<string, string> = {},
) => ({
  query,
  headers: { "x-user-role": "ADMIN", ...headers },
  set:     { status: 200 as number },
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe("adminListOrdersHandler — authorization", () => {
  it("returns 403 when x-user-role is missing", async () => {
    const ctx = makeCtx({}, {})
    ctx.headers["x-user-role"] = undefined as any
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("returns 403 when x-user-role is not ADMIN", async () => {
    const ctx = makeCtx({}, { "x-user-role": "CUSTOMER" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(403)
    expect(res.code).toBe("FORBIDDEN")
  })

  it("proceeds when x-user-role is ADMIN", async () => {
    const ctx = makeCtx()
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(200)
    expect(res).toHaveProperty("items")
  })
})

describe("adminListOrdersHandler — response shaping", () => {
  beforeEach(() => {
    mockFindAllImpl = () =>
      Effect.succeed({
        items: [RAW_DOC], total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false,
      })
  })

  it("strips _id from each item", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    for (const item of res.items) {
      expect(item).not.toHaveProperty("_id")
    }
  })

  it("strips __v from each item", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    for (const item of res.items) {
      expect(item).not.toHaveProperty("__v")
    }
  })

  it("strips __NOTE__ entries from each item's statusHistory", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    for (const item of res.items) {
      const hasNote = item.statusHistory.some((e: any) => e.status === "__NOTE__")
      expect(hasNote).toBe(false)
    }
  })

  it("note content from __NOTE__ entries does not appear in the JSON response", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    const json = JSON.stringify(res)
    expect(json).not.toContain("Dicurigai fraud")
    expect(json).not.toContain("admin-007")
  })

  it("converts Date fields to ISO 8601 strings", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    const item = res.items[0]
    expect(item.createdAt).toBe(now.toISOString())
    expect(item.paidAt).toBe(paid.toISOString())
    expect(item.cancelledAt).toBeNull()
  })

  it("strips _id from sub-documents (line items, shippingAddress, statusHistory)", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    const item = res.items[0]
    for (const li of item.items) expect(li).not.toHaveProperty("_id")
    expect(item.shippingAddress).not.toHaveProperty("_id")
    for (const e of item.statusHistory) expect(e).not.toHaveProperty("_id")
  })

  it("includes all expected top-level item keys", async () => {
    const res = await adminListOrdersHandler(makeCtx() as any) as any
    const keys = Object.keys(res.items[0])
    const expected = [
      "orderId", "userId", "status", "items", "shippingAddress",
      "totalAmount", "shippingFee", "discountAmount", "grandTotal",
      "notes", "statusHistory",
      "createdAt", "updatedAt", "paidAt", "shippedAt", "deliveredAt", "cancelledAt",
    ]
    for (const key of expected) expect(keys).toContain(key)
  })
})

describe("adminListOrdersHandler — pagination pass-through", () => {
  it("returns pagination fields from the repository result", async () => {
    mockFindAllImpl = () =>
      Effect.succeed({
        items: [], total: 95, page: 3, limit: 10, totalPages: 10, hasNext: true, hasPrev: true,
      })
    const ctx = makeCtx({ page: "3", limit: "10" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(res.total).toBe(95)
    expect(res.page).toBe(3)
    expect(res.limit).toBe(10)
    expect(res.totalPages).toBe(10)
    expect(res.hasNext).toBe(true)
    expect(res.hasPrev).toBe(true)
  })

  it("clamps limit to 100 (never exceeds max)", async () => {
    const ctx = makeCtx({ limit: "9999" })
    await adminListOrdersHandler(ctx as any)
    expect((capturedFilters as any).limit).toBe(100)
  })

  it("clamps page to minimum 1", async () => {
    const ctx = makeCtx({ page: "-5" })
    await adminListOrdersHandler(ctx as any)
    expect((capturedFilters as any).page).toBe(1)
  })

  it("defaults page to 1 and limit to 20 when not supplied", async () => {
    const ctx = makeCtx({})
    await adminListOrdersHandler(ctx as any)
    expect((capturedFilters as any).page).toBe(1)
    expect((capturedFilters as any).limit).toBe(20)
  })
})

describe("adminListOrdersHandler — status filter validation", () => {
  it("returns 422 for an unknown status value", async () => {
    const ctx = makeCtx({ status: "NOPE" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("INVALID_STATUS")
    expect(res.error).toContain("NOPE")
  })

  it("accepts comma-separated valid statuses", async () => {
    const ctx = makeCtx({ status: "PAID,PROCESSING" })
    await adminListOrdersHandler(ctx as any)
    expect((capturedFilters as any).status).toEqual(["PAID", "PROCESSING"])
  })

  it("normalises status values to uppercase", async () => {
    const ctx = makeCtx({ status: "paid,processing" })
    await adminListOrdersHandler(ctx as any)
    expect((capturedFilters as any).status).toEqual(["PAID", "PROCESSING"])
  })
})

describe("adminListOrdersHandler — date filter validation", () => {
  it("returns 422 for a non-ISO dateFrom", async () => {
    const ctx = makeCtx({ dateFrom: "not-a-date" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("INVALID_DATE")
  })

  it("returns 422 for a non-ISO dateTo", async () => {
    const ctx = makeCtx({ dateTo: "yesterday" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("INVALID_DATE")
  })

  it("returns 422 when dateFrom is after dateTo", async () => {
    const ctx = makeCtx({ dateFrom: "2024-12-31", dateTo: "2024-01-01" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(422)
    expect(res.code).toBe("INVALID_DATE_RANGE")
  })

  it("accepts a valid dateFrom/dateTo range", async () => {
    const ctx = makeCtx({ dateFrom: "2024-01-01", dateTo: "2024-12-31" })
    await adminListOrdersHandler(ctx as any)
    const f = capturedFilters as any
    expect(f.dateFrom).toBeInstanceOf(Date)
    expect(f.dateTo).toBeInstanceOf(Date)
    // dateTo is extended to end of day
    expect(f.dateTo.getHours()).toBe(23)
    expect(f.dateTo.getMinutes()).toBe(59)
    expect(f.dateTo.getSeconds()).toBe(59)
  })
})

describe("adminListOrdersHandler — filters echoed in response", () => {
  it("echoes userId filter in response.filters", async () => {
    const ctx = makeCtx({ userId: "user-abc" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(res.filters.userId).toBe("user-abc")
  })

  it("echoes status filter as array in response.filters", async () => {
    const ctx = makeCtx({ status: "PAID" })
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(res.filters.status).toEqual(["PAID"])
  })

  it("echoes null filters when none are provided", async () => {
    const ctx = makeCtx({})
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(res.filters.userId).toBeNull()
    expect(res.filters.status).toBeNull()
    expect(res.filters.dateFrom).toBeNull()
    expect(res.filters.dateTo).toBeNull()
  })
})

describe("adminListOrdersHandler — DB failure handling", () => {
  it("returns 500 when findAll fails", async () => {
    mockFindAllImpl = () => Effect.fail(new Error("db connection lost"))
    const ctx = makeCtx()
    const res = await adminListOrdersHandler(ctx as any) as any
    expect(ctx.set.status).toBe(500)
    expect(res.error).toBe("Failed to fetch orders")
  })

  it("does not expose internal error details on DB failure", async () => {
    mockFindAllImpl = () => Effect.fail(new Error("topology destroyed"))
    const ctx = makeCtx()
    const res = await adminListOrdersHandler(ctx as any) as any
    const json = JSON.stringify(res)
    expect(json).not.toContain("topology destroyed")
  })
})

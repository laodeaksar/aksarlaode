import { describe, it, expect } from "bun:test"
import { shapeOrder } from "../shape-order"

// ── Minimal valid raw Mongoose doc fixture ─────────────────────────────────

const now   = new Date("2024-05-13T10:00:00.000Z")
const paid  = new Date("2024-05-13T10:05:00.000Z")

const RAW_DOC = {
  // Mongoose internals — must NEVER appear in output
  _id:  "664f1234abcd1234abcd1234",
  __v:  3,

  // Business fields
  orderId:  "ORD-20240513-A3F9B2C1",
  userId:   "user-uuid-001",
  status:   "PAID",

  items: [
    {
      productId:   "prod-uuid-001",
      productName: "Sepatu Running",
      sku:         "SKU-RUN-001",
      imageUrl:    "https://cdn.example.com/shoes.jpg",
      price:       350_000,
      quantity:    2,
      subtotal:    700_000,
      // extra Mongoose internal on sub-doc
      _id: "664f0001abcd0001abcd0001",
    },
  ],

  shippingAddress: {
    recipientName: "Budi Santoso",
    phone:         "08123456789",
    street:        "Jl. Merdeka No. 1",
    city:          "Jakarta",
    province:      "DKI Jakarta",
    postalCode:    "10110",
    country:       "ID",
    _id:           "664f0002abcd0002abcd0002",
  },

  totalAmount:    700_000,
  shippingFee:    15_000,
  discountAmount: 0,
  grandTotal:     715_000,
  notes:          "Tolong dibungkus rapi",

  statusHistory: [
    {
      status:    "PENDING_PAYMENT",
      note:      null,
      changedBy: "system",
      timestamp: now,
      _id:       "664f0003abcd0003abcd0003",
    },
    // ── Admin-only note — must be stripped from customer view ─────────────
    {
      status:    "__NOTE__",
      note:      "Dicurigai fraud, sedang diinvestigasi",
      changedBy: "admin-007",
      timestamp: now,
      _id:       "664f0004abcd0004abcd0004",
    },
    {
      status:    "PAID",
      note:      null,
      changedBy: "service:midtrans",
      timestamp: paid,
      _id:       "664f0005abcd0005abcd0005",
    },
  ],

  createdAt:   now,
  updatedAt:   paid,
  paidAt:      paid,
  shippedAt:   null,
  deliveredAt: null,
  cancelledAt: null,

  // Hypothetical future Mongoose/plugin field — must not leak
  __someMongooseInternal: true,
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// ── Tests ──────────────────────────────────────────────────────────────────

describe("shapeOrder — Mongoose internals", () => {
  it("never includes _id at the top level", () => {
    const out = shapeOrder(RAW_DOC)
    expect(out).not.toHaveProperty("_id")
  })

  it("never includes __v", () => {
    const out = shapeOrder(RAW_DOC)
    expect(out).not.toHaveProperty("__v")
  })

  it("never includes unknown top-level fields", () => {
    const out = shapeOrder(RAW_DOC) as Record<string, unknown>
    expect(out).not.toHaveProperty("__someMongooseInternal")
  })

  it("never includes _id on line items", () => {
    const out = shapeOrder(RAW_DOC)
    for (const item of out.items) {
      expect(item).not.toHaveProperty("_id")
    }
  })

  it("never includes _id on shippingAddress", () => {
    const out = shapeOrder(RAW_DOC)
    expect(out.shippingAddress).not.toHaveProperty("_id")
  })

  it("never includes _id on statusHistory entries", () => {
    const out = shapeOrder(RAW_DOC)
    for (const entry of out.statusHistory) {
      expect(entry).not.toHaveProperty("_id")
    }
  })
})

describe("shapeOrder — __NOTE__ sentinel filtering", () => {
  it("strips __NOTE__ entries from statusHistory", () => {
    const out = shapeOrder(RAW_DOC)
    const hasNote = out.statusHistory.some(e => e.status === "__NOTE__")
    expect(hasNote).toBe(false)
  })

  it("preserves legitimate status entries", () => {
    const out = shapeOrder(RAW_DOC)
    const statuses = out.statusHistory.map(e => e.status)
    expect(statuses).toContain("PENDING_PAYMENT")
    expect(statuses).toContain("PAID")
  })

  it("preserves order of remaining statusHistory entries", () => {
    const out = shapeOrder(RAW_DOC)
    expect(out.statusHistory[0]!.status).toBe("PENDING_PAYMENT")
    expect(out.statusHistory[1]!.status).toBe("PAID")
  })

  it("admin note content is not accessible anywhere in the output", () => {
    const out = shapeOrder(RAW_DOC)
    const json = JSON.stringify(out)
    expect(json).not.toContain("Dicurigai fraud")
    expect(json).not.toContain("admin-007")
  })
})

describe("shapeOrder — Date → ISO 8601 conversion", () => {
  it("converts createdAt to ISO string", () => {
    const { createdAt } = shapeOrder(RAW_DOC)
    expect(typeof createdAt).toBe("string")
    expect(createdAt).toMatch(ISO_RE)
    expect(createdAt).toBe(now.toISOString())
  })

  it("converts updatedAt to ISO string", () => {
    const { updatedAt } = shapeOrder(RAW_DOC)
    expect(updatedAt).toBe(paid.toISOString())
  })

  it("converts paidAt to ISO string", () => {
    const { paidAt } = shapeOrder(RAW_DOC)
    expect(paidAt).toBe(paid.toISOString())
  })

  it("converts statusHistory timestamps to ISO strings", () => {
    const { statusHistory } = shapeOrder(RAW_DOC)
    for (const entry of statusHistory) {
      expect(typeof entry.timestamp).toBe("string")
      expect(entry.timestamp).toMatch(ISO_RE)
    }
  })

  it("returns null (not undefined) for null Date fields", () => {
    const { shippedAt, deliveredAt, cancelledAt } = shapeOrder(RAW_DOC)
    expect(shippedAt).toBeNull()
    expect(deliveredAt).toBeNull()
    expect(cancelledAt).toBeNull()
  })
})

describe("shapeOrder — cancelledAt timestamp assertion", () => {
  it("sets cancelledAt when status is CANCELLED", () => {
    const cancelled = new Date("2024-05-14T08:00:00.000Z")
    const doc = { ...RAW_DOC, status: "CANCELLED", cancelledAt: cancelled }
    const { cancelledAt, status } = shapeOrder(doc)
    expect(status).toBe("CANCELLED")
    expect(cancelledAt).toBe(cancelled.toISOString())
  })

  it("cancelledAt is null when order is not cancelled", () => {
    const { cancelledAt } = shapeOrder(RAW_DOC)
    expect(cancelledAt).toBeNull()
  })
})

describe("shapeOrder — allowlist field coverage", () => {
  it("includes all expected top-level keys", () => {
    const out = shapeOrder(RAW_DOC)
    const keys = Object.keys(out)
    const expected = [
      "orderId", "userId", "status", "items", "shippingAddress",
      "totalAmount", "shippingFee", "discountAmount", "grandTotal",
      "notes", "statusHistory",
      "createdAt", "updatedAt", "paidAt", "shippedAt", "deliveredAt", "cancelledAt",
    ]
    for (const key of expected) {
      expect(keys).toContain(key)
    }
  })

  it("includes all expected line item keys", () => {
    const { items } = shapeOrder(RAW_DOC)
    const keys = Object.keys(items[0]!)
    expect(keys).toContain("productId")
    expect(keys).toContain("productName")
    expect(keys).toContain("sku")
    expect(keys).toContain("imageUrl")
    expect(keys).toContain("price")
    expect(keys).toContain("quantity")
    expect(keys).toContain("subtotal")
  })

  it("falls back to null for missing optional imageUrl", () => {
    const doc = {
      ...RAW_DOC,
      items: [{ ...RAW_DOC.items[0], imageUrl: undefined }],
    }
    const { items } = shapeOrder(doc)
    expect(items[0]!.imageUrl).toBeNull()
  })

  it("falls back to 0 for missing shippingFee", () => {
    const doc = { ...RAW_DOC, shippingFee: undefined }
    expect(shapeOrder(doc).shippingFee).toBe(0)
  })

  it("falls back to 0 for missing discountAmount", () => {
    const doc = { ...RAW_DOC, discountAmount: undefined }
    expect(shapeOrder(doc).discountAmount).toBe(0)
  })

  it("falls back to 'ID' for missing shippingAddress.country", () => {
    const doc = {
      ...RAW_DOC,
      shippingAddress: { ...RAW_DOC.shippingAddress, country: undefined },
    }
    expect(shapeOrder(doc).shippingAddress.country).toBe("ID")
  })

  it("handles empty statusHistory gracefully", () => {
    const doc = { ...RAW_DOC, statusHistory: [] }
    expect(shapeOrder(doc).statusHistory).toEqual([])
  })

  it("handles empty items array gracefully", () => {
    const doc = { ...RAW_DOC, items: [] }
    expect(shapeOrder(doc).items).toEqual([])
  })
})

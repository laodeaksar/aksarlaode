import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  or,
  SQL,
} from "drizzle-orm"

import { schema } from "@repo/database"

export type ProductFilters = {
  search?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sortBy?: "price_asc" | "price_desc" | "newest" | "popular"
  page?: number
  limit?: number
  // FIX PRD-07: cursor-based pagination.
  // Provide this instead of `page` for efficient deep pagination.
  // Value is a base64url-encoded "<createdAt ISO>:<id>" string from the
  // previous page's `nextCursor` field.
  cursor?: string
}

export function buildProductQuery(filters: ProductFilters) {
  const conditions: SQL[] = []

  // FIX PRD-04: always exclude soft-deleted products
  conditions.push(isNull(schema.products.deletedAt))

  if (filters.search)
    conditions.push(ilike(schema.products.name, `%${filters.search}%`))

  if (filters.categoryId)
    conditions.push(eq(schema.products.categoryId, filters.categoryId))

  if (filters.minPrice !== undefined)
    conditions.push(gte(schema.products.price, filters.minPrice))

  if (filters.maxPrice !== undefined)
    conditions.push(lte(schema.products.price, filters.maxPrice))

  if (filters.inStock) conditions.push(gte(schema.products.stock, 1))

  // FIX PRD-07: cursor decoding — if cursor is provided, add a WHERE clause
  // that picks up from after the last item on the previous page.
  // Cursor encodes createdAt + id so ties on the same millisecond are broken.
  let activeCursor: string | null = null
  if (filters.cursor) {
    try {
      const decoded = Buffer.from(filters.cursor, "base64url").toString("utf8")
      const sepIdx = decoded.lastIndexOf(":")
      if (sepIdx > 0) {
        const cursorDate = decoded.slice(0, sepIdx)
        const cursorId = decoded.slice(sepIdx + 1)
        // For "newest" sort (desc createdAt): rows AFTER the cursor have
        // createdAt < cursorDate, or equal createdAt with id < cursorId.
        conditions.push(
          or(
            lt(schema.products.createdAt, new Date(cursorDate)),
            and(
              eq(schema.products.createdAt, new Date(cursorDate)),
              lt(schema.products.id, cursorId)
            )
          )!
        )
        activeCursor = filters.cursor
      }
    } catch {
      // Malformed cursor — ignore and fall back to first page
    }
  }

  const orderBy = {
    price_asc: asc(schema.products.price),
    price_desc: desc(schema.products.price),
    newest: desc(schema.products.createdAt),
    popular: desc(schema.products.salesCount),
  }[filters.sortBy ?? "newest"]

  const limit = Math.min(filters.limit ?? 20, 100)
  // When using cursor pagination, offset is always 0 (cursor already positions us)
  const offset = activeCursor ? 0 : ((filters.page ?? 1) - 1) * limit

  return {
    where: and(...conditions),
    orderBy,
    limit,
    offset,
    cursor: activeCursor,
  }
}

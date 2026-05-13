import { and, asc, desc, eq, gte, ilike, lte, SQL } from "drizzle-orm"
import { schema } from "@repo/database"

export type ProductFilters = {
  search?:    string
  categoryId?: string
  minPrice?:  number
  maxPrice?:  number
  inStock?:   boolean
  sortBy?:    "price_asc" | "price_desc" | "newest" | "popular"
  page?:      number
  limit?:     number
}

export function buildProductQuery(filters: ProductFilters) {
  const conditions: SQL[] = []

  if (filters.search)
    conditions.push(ilike(schema.products.name, `%${filters.search}%`))

  if (filters.categoryId)
    conditions.push(eq(schema.products.categoryId, filters.categoryId))

  if (filters.minPrice !== undefined)
    conditions.push(gte(schema.products.price, filters.minPrice))

  if (filters.maxPrice !== undefined)
    conditions.push(lte(schema.products.price, filters.maxPrice))

  if (filters.inStock)
    conditions.push(gte(schema.products.stock, 1))

  const orderBy = {
    price_asc:  asc(schema.products.price),
    price_desc: desc(schema.products.price),
    newest:     desc(schema.products.createdAt),
    popular:    desc(schema.products.salesCount),
  }[filters.sortBy ?? "newest"]

  const limit  = Math.min(filters.limit ?? 20, 100)
  const offset = ((filters.page ?? 1) - 1) * limit

  return { where: and(...conditions), orderBy, limit, offset }
}

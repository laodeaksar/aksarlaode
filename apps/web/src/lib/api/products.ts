import { Effect } from "effect"
import { apiFetch }   from "./client"
import { NotFoundError } from "@/effect/errors"
import type { Product } from "@repo/common"

export type ProductListParams = {
  search?:    string
  categoryId?: string
  minPrice?:  number
  maxPrice?:  number
  inStock?:   boolean
  sortBy?:    "price_asc" | "price_desc" | "newest" | "popular"
  page?:      number
  limit?:     number
}

export type ProductListResult = {
  items: Product[]
  total: number
  page:  number
  limit: number
}

export const productsApi = {
  list: (params: ProductListParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString()

    return apiFetch<ProductListResult>(`/products${qs ? `?${qs}` : ""}`)
  },

  getBySlug: (slug: string, cookie?: string) =>
    apiFetch<Product>(`/products/slug/${slug}`, { cookie }),

  getById: (id: string) =>
    apiFetch<Product>(`/products/${id}`),
}

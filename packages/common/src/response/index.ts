// ─────────────────────────────────────────────────────────────────────────────
// Standard response shapes for all services.
//
// Usage in Hono handlers:
//   return c.json(ok(user))
//   return c.json(ok(user, { token: "..." }))
//   return c.json(paginated(items, { page: 1, limit: 20, total: 100 }))
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OkResponse<T> {
  data: T
}

export interface OkResponseWithMeta<T, M extends Record<string, unknown>> {
  data: T
  meta: M
}

export interface PaginationMeta {
  page:         number
  limit:        number
  total:        number
  totalPages:   number
  hasNextPage:  boolean
  hasPrevPage:  boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface MessageResponse {
  message: string
}

// ── Builders ──────────────────────────────────────────────────────────────────

/**
 * Wrap a single resource in a standard { data } envelope.
 *
 * @example
 * return c.json(ok(user))
 * // → { data: { id: "...", name: "..." } }
 */
export function ok<T>(data: T): OkResponse<T>

/**
 * Wrap a single resource with additional top-level meta fields.
 *
 * @example
 * return c.json(ok(user, { accessToken: "..." }))
 * // → { data: { id: "..." }, meta: { accessToken: "..." } }
 */
export function ok<T, M extends Record<string, unknown>>(
  data: T,
  meta: M
): OkResponseWithMeta<T, M>

export function ok<T, M extends Record<string, unknown>>(
  data: T,
  meta?: M
): OkResponse<T> | OkResponseWithMeta<T, M> {
  return meta !== undefined ? { data, meta } : { data }
}

/**
 * Wrap an array with full pagination metadata.
 * Automatically computes totalPages, hasNextPage, hasPrevPage.
 *
 * @example
 * return c.json(paginated(sessions, { page: 1, limit: 20, total: 45 }))
 * // → {
 * //     data: [...],
 * //     meta: { page: 1, limit: 20, total: 45, totalPages: 3, hasNextPage: true, hasPrevPage: false }
 * //   }
 */
export function paginated<T>(
  data: T[],
  input: { page: number; limit: number; total: number }
): PaginatedResponse<T> {
  const totalPages  = Math.ceil(input.total / input.limit) || 1
  const hasNextPage = input.page < totalPages
  const hasPrevPage = input.page > 1

  return {
    data,
    meta: {
      page:  input.page,
      limit: input.limit,
      total: input.total,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  }
}

/**
 * Standard message-only response (logout, revoke, etc.)
 *
 * @example
 * return c.json(message("Session revoked"))
 * // → { message: "Session revoked" }
 */
export function message(text: string): MessageResponse {
  return { message: text }
}

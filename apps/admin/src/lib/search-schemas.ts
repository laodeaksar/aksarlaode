import * as v from "valibot";

// ── Reusable primitives ─────────────────────────────────────────────────────

/**
 * Page number: integer >= 2, or undefined (means page 1).
 * `v.fallback` mirrors Zod's `.catch(undefined)` — invalid URL values are
 * silently dropped instead of throwing a navigation error.
 */
const pageSchema = v.fallback(
  v.optional(v.pipe(v.number(), v.integer(), v.minValue(2))),
  undefined
);

/** Non-empty string, or undefined. */
const optionalString = v.fallback(
  v.optional(v.pipe(v.string(), v.minLength(1))),
  undefined
);

// ── Per-route search schemas ────────────────────────────────────────────────

export const productsSearchSchema = v.object({
  page: pageSchema,
  search: optionalString,
});

export const ordersSearchSchema = v.object({
  page: pageSchema,
  status: optionalString,
});

export const customersSearchSchema = v.object({
  page: pageSchema,
  search: optionalString,
});

export const auditLogsSearchSchema = v.object({
  page: pageSchema,
  startDate: optionalString,
  endDate: optionalString,
  action: optionalString,
  actorRole: optionalString,
});

export const usersSearchSchema = v.object({
  page: pageSchema,
  search: optionalString,
});

export const loginSearchSchema = v.object({
  // logout=1 sent by NavUser after a successful logout to trigger the toast.
  logout: v.fallback(v.optional(v.literal("1")), undefined),
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type ProductsSearch = v.InferOutput<typeof productsSearchSchema>;
export type OrdersSearch = v.InferOutput<typeof ordersSearchSchema>;
export type CustomersSearch = v.InferOutput<typeof customersSearchSchema>;
export type AuditLogsSearch = v.InferOutput<typeof auditLogsSearchSchema>;
export type UsersSearch = v.InferOutput<typeof usersSearchSchema>;
export type LoginSearch = v.InferOutput<typeof loginSearchSchema>;

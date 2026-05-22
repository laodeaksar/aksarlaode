import { z } from "zod";

// ── Reusable primitives ─────────────────────────────────────────────────────

/** Page number: integer >= 2, or undefined (means page 1). */
const pageSchema = z
  .number()
  .int()
  .min(2)
  .optional()
  .catch(undefined);

/** Non-empty string, or undefined. */
const optionalString = z.string().min(1).optional().catch(undefined);

// ── Per-route search schemas ────────────────────────────────────────────────

export const productsSearchSchema = z.object({
  page: pageSchema,
  search: optionalString,
});

export const ordersSearchSchema = z.object({
  page: pageSchema,
  status: optionalString,
});

export const customersSearchSchema = z.object({
  page: pageSchema,
  search: optionalString,
});

export const auditLogsSearchSchema = z.object({
  page: pageSchema,
  startDate: optionalString,
  endDate: optionalString,
  action: optionalString,
  actorRole: optionalString,
});

export const usersSearchSchema = z.object({
  page: pageSchema,
  search: optionalString,
});

export const loginSearchSchema = z.object({
  logout: z.literal("1").optional().catch(undefined),
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type ProductsSearch = z.infer<typeof productsSearchSchema>;
export type OrdersSearch = z.infer<typeof ordersSearchSchema>;
export type CustomersSearch = z.infer<typeof customersSearchSchema>;
export type AuditLogsSearch = z.infer<typeof auditLogsSearchSchema>;
export type UsersSearch = z.infer<typeof usersSearchSchema>;
export type LoginSearch = z.infer<typeof loginSearchSchema>;

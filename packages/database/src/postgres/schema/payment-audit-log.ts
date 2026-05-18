import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { payments } from "./payments";
import { users } from "./users";

// FIX PAY-08: Immutable append-only audit log for every payment status
// transition. Only INSERTs are ever issued — no UPDATE or DELETE.
// Used for financial reconciliation and fraud investigation.
export const paymentAuditLog = pgTable("payment_audit_log", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id")
    .notNull()
    .references(() => payments.id),
  orderId: text("order_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  event: text("event").notNull(), // "payment_initiated" | "payment_status_changed"
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  amount: integer("amount").notNull(),
  paymentType: text("payment_type"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaymentAuditLog = typeof paymentAuditLog.$inferSelect;
export type NewPaymentAuditLog = typeof paymentAuditLog.$inferInsert;

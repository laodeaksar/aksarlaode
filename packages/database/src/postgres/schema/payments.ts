import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { users } from "./users"

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
])

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().unique(), // from MongoDB order-service
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  amount: integer("amount").notNull(),
  status: paymentStatusEnum("status").default("PENDING").notNull(),
  snapToken: text("snap_token"),
  paymentType: text("payment_type"), // "bank_transfer", "gopay", etc.
  // FIX PAY-07: store user email at initiation time so webhook never needs a
  // round-trip to auth-service to populate email jobs.
  userEmail: text("user_email"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

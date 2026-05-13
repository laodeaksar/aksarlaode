import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./users"

export const sessions = pgTable("sessions", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type Session    = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

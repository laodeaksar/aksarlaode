import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./users"

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token:     text("token").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type PasswordResetToken    = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert

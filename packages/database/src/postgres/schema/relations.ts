import { relations } from "drizzle-orm"

import { categories } from "./categories"
import { passwordResetTokens } from "./password-reset-tokens"
import { paymentAuditLog } from "./payment-audit-log"
import { payments } from "./payments"
import { products } from "./products"
import { sessions } from "./sessions"
import { users } from "./users"

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  payments: many(payments),
  passwordResetTokens: many(passwordResetTokens),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}))

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(products),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  auditLogs: many(paymentAuditLog),
}))

export const paymentAuditLogRelations = relations(
  paymentAuditLog,
  ({ one }) => ({
    payment: one(payments, {
      fields: [paymentAuditLog.paymentId],
      references: [payments.id],
    }),
    user: one(users, {
      fields: [paymentAuditLog.userId],
      references: [users.id],
    }),
  })
)

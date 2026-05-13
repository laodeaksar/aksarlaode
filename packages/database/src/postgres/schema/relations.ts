import { relations } from "drizzle-orm"
import { users }     from "./users"
import { sessions }  from "./sessions"
import { products }  from "./products"
import { categories } from "./categories"
import { payments }  from "./payments"

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  payments: many(payments),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}))

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(products),
  parent:   one(categories, { fields: [categories.parentId], references: [categories.id] }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}))

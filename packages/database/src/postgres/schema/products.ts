import {
  pgTable, text, timestamp, integer,
  numeric, boolean, jsonb, pgEnum
} from "drizzle-orm/pg-core"
import { categories } from "./categories"

export const productStatusEnum = pgEnum("product_status", [
  "DRAFT", "ACTIVE", "ARCHIVED"
])

export const products = pgTable("products", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  slug:        text("slug").notNull().unique(),
  sku:         text("sku").notNull().unique(),
  description: text("description"),
  categoryId:  text("category_id").references(() => categories.id, { onDelete: "set null" }),
  price:       integer("price").notNull(),           // stored in smallest currency unit (cents/rupiah)
  comparePrice: integer("compare_price"),            // original price for "sale" display
  stock:       integer("stock").notNull().default(0),
  weight:      integer("weight"),                    // grams
  imageUrls:   jsonb("image_urls").$type<string[]>().default([]),
  tags:        jsonb("tags").$type<string[]>().default([]),
  status:      productStatusEnum("status").default("DRAFT").notNull(),
  isDigital:   boolean("is_digital").default(false),
  salesCount:  integer("sales_count").default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
})

export type Product    = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert

import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// FIX ADM-06b: Immutable audit log for sensitive admin actions.
// Append-only — only INSERTs are ever issued; no UPDATE or DELETE.
export const adminAuditLog = pgTable("admin_audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(), // "product_deleted" | "order_status_changed" | "user_role_changed"
  resource: text("resource").notNull(), // "product" | "order" | "user"
  resourceId: text("resource_id").notNull(),
  oldValue: jsonb("old_value").$type<Record<string, unknown>>(),
  newValue: jsonb("new_value").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;

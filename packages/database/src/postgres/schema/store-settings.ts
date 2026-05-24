import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ── Store-wide runtime settings ────────────────────────────────────────────
// Single-row table: always upserted with id = "global".
// Services read their initial values from here on startup and then subscribe
// to the Redis channel "store:config:updated" for live reload.
// The gateway writes here via PUT /admin/settings (OWNER only).

export type StoreSettings = {
  paymentExpiryMinutes: number;
  minimumOrderAmount: number;
  maxOrderItemsPerOrder: number;
  maintenanceMode: boolean;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  paymentExpiryMinutes: 60,
  minimumOrderAmount: 1000,
  maxOrderItemsPerOrder: 50,
  maintenanceMode: false,
};

export const storeSettings = pgTable("store_settings", {
  id: text("id").primaryKey(),
  value: jsonb("value").$type<StoreSettings>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: text("updated_by"),
});

export type StoreSettingsRow = typeof storeSettings.$inferSelect;

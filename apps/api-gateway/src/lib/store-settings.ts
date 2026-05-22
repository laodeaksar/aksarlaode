/**
 * Store settings persistence and pub/sub notification.
 *
 * The gateway is the single writer for store settings — it owns the
 * Postgres row and broadcasts changes to all services via Redis pub/sub.
 *
 * Read path:  GET /admin/settings  → getStoreSettings()
 * Write path: PUT /admin/settings  → upsertStoreSettings() → PUBLISH channel
 *
 * Redis failures on the publish step are logged and swallowed — the Postgres
 * write already committed, so services will pick up the new config on next
 * restart at worst.
 */

import { db, DEFAULT_STORE_SETTINGS, eq, schema, sql } from "@repo/database";
import type { StoreSettings } from "@repo/database";

import { getRedis } from "./redis";

export const SETTINGS_CHANNEL = "store:config:updated";
const SETTINGS_ROW_ID = "global";

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const rows = await db
      .select()
      .from(schema.storeSettings)
      .where(eq(schema.storeSettings.id, SETTINGS_ROW_ID))
      .limit(1);
    return rows[0]?.value ?? DEFAULT_STORE_SETTINGS;
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "settings_read_error",
        message: String(err),
      })
    );
    return DEFAULT_STORE_SETTINGS;
  }
}

export async function upsertStoreSettings(
  value: StoreSettings,
  updatedBy: string
): Promise<StoreSettings> {
  const [row] = await db
    .insert(schema.storeSettings)
    .values({ id: SETTINGS_ROW_ID, value, updatedBy })
    .onConflictDoUpdate({
      target: schema.storeSettings.id,
      set: { value, updatedBy, updatedAt: sql`now()` },
    })
    .returning();

  if (!row) throw new Error("Store settings upsert returned no row");

  // Publish for live reload — fire-and-forget, failure is non-fatal
  getRedis()
    .publish(SETTINGS_CHANNEL, JSON.stringify(row.value))
    .catch((err: unknown) =>
      console.warn(
        JSON.stringify({
          event: "settings_publish_error",
          message: String(err),
        })
      )
    );

  return row.value;
}

export function isValidStoreSettings(value: unknown): value is StoreSettings {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["paymentExpiryMinutes"] === "number" &&
    v["paymentExpiryMinutes"] >= 1 &&
    typeof v["minimumOrderAmount"] === "number" &&
    v["minimumOrderAmount"] >= 0 &&
    typeof v["maxOrderItemsPerOrder"] === "number" &&
    v["maxOrderItemsPerOrder"] >= 1 &&
    typeof v["maintenanceMode"] === "boolean"
  );
}

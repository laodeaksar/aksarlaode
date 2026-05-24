/**
 * In-memory store configuration for the order service.
 *
 * On startup the config is seeded from environment variables (existing
 * defaults). When the admin panel writes new settings the API gateway
 * publishes them to the Redis channel "store:config:updated"; this module
 * subscribes on that channel and updates the in-memory snapshot so all
 * subsequent requests see the new values without a restart.
 *
 * getStoreConfig() is safe to call on every request — it is a synchronous
 * read of a plain object, zero I/O.
 */

import Redis from "ioredis";

import { env } from "@repo/env/order";

export type StoreConfig = {
  paymentExpiryMinutes: number;
  minimumOrderAmount: number;
  maxOrderItemsPerOrder: number;
  maintenanceMode: boolean;
};

export const SETTINGS_CHANNEL = "store:config:updated";

const DEFAULT: StoreConfig = {
  // env values are optional-with-default; fallback to the schema's default
  // values in case the env schema produces undefined (exactOptionalPropertyTypes).
  paymentExpiryMinutes: env.PAYMENT_EXPIRY_MINUTES ?? 60,
  minimumOrderAmount: env.MINIMUM_ORDER_AMOUNT ?? 1000,
  maxOrderItemsPerOrder: 50,
  maintenanceMode: false,
};

let _config: StoreConfig = { ...DEFAULT };

export function getStoreConfig(): StoreConfig {
  return _config;
}

export function startConfigWatcher(): void {
  const subscriber = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 500,
  });

  subscriber.on("error", (err) =>
    console.warn(
      JSON.stringify({ event: "config_watcher_error", message: String(err) })
    )
  );

  subscriber.subscribe(SETTINGS_CHANNEL, (err) => {
    if (err) {
      console.warn(
        JSON.stringify({
          event: "config_subscribe_error",
          message: String(err),
        })
      );
    } else {
      console.info(
        JSON.stringify({
          event: "config_watcher_started",
          channel: SETTINGS_CHANNEL,
        })
      );
    }
  });

  subscriber.on("message", (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message) as Partial<StoreConfig>;
      _config = {
        paymentExpiryMinutes:
          typeof parsed.paymentExpiryMinutes === "number"
            ? parsed.paymentExpiryMinutes
            : DEFAULT.paymentExpiryMinutes,
        minimumOrderAmount:
          typeof parsed.minimumOrderAmount === "number"
            ? parsed.minimumOrderAmount
            : DEFAULT.minimumOrderAmount,
        maxOrderItemsPerOrder:
          typeof parsed.maxOrderItemsPerOrder === "number"
            ? parsed.maxOrderItemsPerOrder
            : DEFAULT.maxOrderItemsPerOrder,
        maintenanceMode:
          typeof parsed.maintenanceMode === "boolean"
            ? parsed.maintenanceMode
            : DEFAULT.maintenanceMode,
      };
      console.info(
        JSON.stringify({ event: "store_config_reloaded", config: _config })
      );
    } catch {
      console.warn(
        JSON.stringify({ event: "config_reload_parse_error", raw: message })
      );
    }
  });
}

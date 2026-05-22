/**
 * In-memory store configuration for the payment service.
 *
 * Mirrors the pattern in order-service/src/lib/store-config.ts.
 * Subscribes to the Redis "store:config:updated" channel so that changes
 * saved via the admin settings page take effect without a restart.
 */

import Redis from "ioredis";

import { env } from "@repo/env/payment";

export type StoreConfig = {
  paymentExpiryMinutes: number;
  minimumOrderAmount: number;
  maxOrderItemsPerOrder: number;
  maintenanceMode: boolean;
};

export const SETTINGS_CHANNEL = "store:config:updated";

const DEFAULT: StoreConfig = {
  paymentExpiryMinutes: 60,
  minimumOrderAmount: 1000,
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

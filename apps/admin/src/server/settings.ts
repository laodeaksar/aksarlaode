import { createServerFn } from "@tanstack/react-start";

import { Effect, Schema } from "effect";

import { auditMiddleware } from "@/effect/AuditMiddleware";
import { requirePermission } from "@/effect/AuthMiddleware";
import { effectMiddleware } from "@/effect/Middleware";
import { ApiClientService } from "@/effect/Services";
import { StoreSettingsSchema } from "@/effect/Services.schemas";
import type { StoreSettings } from "@/effect/Services.schemas";

import { decodeOrThrow } from "./_utils";

// ── GET /admin/settings ────────────────────────────────────────────────────
// Loader for the Settings route — returns current store configuration.
// requirePermission("settings:write") keeps this OWNER-only: reading the
// current config is low-value but consistent with the write gate.

export const getSettingsFn = createServerFn({ method: "GET" })
  .middleware([effectMiddleware, requirePermission("settings:write")])
  .handler(
    async ({ context }): Promise<StoreSettings> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          const res = yield* api.settings.get();
          return res.data;
        })
      )
  );

// ── POST /admin/settings (mutating — TanStack Start convention) ────────────
// Validates input, writes to Postgres via the gateway, and the gateway
// publishes store:config:updated to Redis so running services reload.
// auditMiddleware records the change in the admin_audit_log table.

export const updateSettingsFn = createServerFn({ method: "POST" })
  .middleware([
    effectMiddleware,
    requirePermission("settings:write"),
    auditMiddleware,
  ])
  .inputValidator((raw: unknown) =>
    decodeOrThrow(
      StoreSettingsSchema,
      raw as Schema.Schema.Encoded<typeof StoreSettingsSchema>
    )
  )
  .handler(
    async ({ data, context }): Promise<StoreSettings> =>
      context.runtime.runPromise(
        Effect.gen(function* () {
          const api = yield* ApiClientService;
          const res = yield* api.settings.update(data);
          return res.data;
        })
      )
  );

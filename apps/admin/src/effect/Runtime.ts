import { Layer, ManagedRuntime } from "effect"

import { ApiClientService, ConfigService } from "./Services"

// ── Application Layer ──────────────────────────────────────────────────────
// `ApiClientService.Default` requires `ConfigService` internally.
// `Layer.provide` wires that dependency so the composed layer is self-contained.

export const AppLayer = ApiClientService.Default.pipe(
  Layer.provide(ConfigService.Default)
)

// ── Server Runtime ─────────────────────────────────────────────────────────
// `ManagedRuntime` is suitable for long-lived server processes.
// It manages fiber/resource lifecycle across all server function invocations.
//
// The runtime provides `ApiClientService` (which internally uses ConfigService).
// Server functions only need to `yield* ApiClientService` — ConfigService is
// an implementation detail handled by the layer.
//
// IMPORTANT: used exclusively inside TanStack Start server functions.
// Never imported in client-side code.

export const AppRuntime = ManagedRuntime.make(AppLayer)

// ── Exported service type ─────────────────────────────────────────────────
// Only ApiClientService is exposed as the public requirement type.
// ConfigService is an internal dependency resolved by AppLayer.
export type AppServices = ApiClientService

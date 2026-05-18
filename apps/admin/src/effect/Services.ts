// ── Services barrel ────────────────────────────────────────────────────────
// Re-exports all public symbols from the three sub-modules so that existing
// imports (`from "@/effect/Services"`) continue to work unchanged.
//
// Prefer importing directly from the sub-module in new code:
//   import { ConfigService }    from "@/effect/Services.config"
//   import { ProductSchema }    from "@/effect/Services.schemas"
//   import { ApiClientService } from "@/effect/Services.api"

export * from "./Services.config"
export * from "./Services.schemas"
export * from "./Services.api"

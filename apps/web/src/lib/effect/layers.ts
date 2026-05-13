import { Layer, Context } from "effect"
import { env }            from "@repo/env"

// ── ApiConfig service ──────────────────────────────────────
export class ApiConfig extends Context.Tag("ApiConfig")<
  ApiConfig,
  { baseUrl: string; timeout: number }
>() {}

export const ApiConfigLayer = Layer.succeed(ApiConfig, {
  baseUrl: env.PUBLIC_API_URL,
  timeout: 10_000,
})

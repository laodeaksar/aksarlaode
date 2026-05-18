import { Effect } from "effect";

// ── ConfigService ──────────────────────────────────────────────────────────
// Reads env vars once at runtime init. Server-only — never bundled to client.
// `process.env` is available in TanStack Start server functions.

export class ConfigService extends Effect.Service<ConfigService>()(
  "admin/ConfigService",
  {
    effect: Effect.sync(
      () =>
        ({
          apiUrl: process.env["PUBLIC_API_URL"] ?? "http://localhost:3000",
          adminUrl: process.env["ADMIN_URL"] ?? "http://localhost:4322",
          internalToken: process.env["INTERNAL_SERVICE_TOKEN"] ?? "",
        }) as const
    ),
  }
) {}

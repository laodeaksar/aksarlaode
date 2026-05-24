import { Hono } from "hono";

import {
  getStoreSettings,
  isValidStoreSettings,
  upsertStoreSettings,
} from "@/lib/store-settings";
import type { AppEnv } from "@/types/context";

// ── /admin/settings ───────────────────────────────────────────────────────
// GET  — ADMIN and above (routeGuard enforces minRole: "ADMIN" via the
//         general /admin catch-all rule in route-permissions.ts).
// PUT  — OWNER only (enforced by a more-specific rule added above the
//         general admin catch-all in route-permissions.ts).
//
// These routes are handled inline — no downstream service proxy needed
// since the gateway already owns the Redis connection for pub/sub and
// the Postgres connection for settings persistence.

const router = new Hono<AppEnv>();

router.get("/", async (c) => {
  const settings = await getStoreSettings();
  return c.json({ data: settings });
});

router.put("/", async (c) => {
  const user = c.var.user;
  // routeGuard already enforces OWNER for PUT — this is defence-in-depth.
  if (!user || user.role !== "OWNER") {
    return c.json({ error: "Forbidden", code: "FORBIDDEN" }, 403);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body", code: "PARSE_ERROR" }, 400);
  }

  if (!isValidStoreSettings(body)) {
    return c.json(
      {
        error:
          "Invalid settings payload — check field types and minimum values.",
        code: "VALIDATION_ERROR",
      },
      400
    );
  }

  const updated = await upsertStoreSettings(body, user.id);
  return c.json({ data: updated });
});

export default router;

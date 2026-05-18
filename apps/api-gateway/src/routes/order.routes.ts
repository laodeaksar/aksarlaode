import { Hono } from "hono";

import type { AppEnv } from "@/types/context";
import { ownerOrAdmin } from "@/middleware/owner-or-admin";
import { proxyTo } from "@/proxy/proxy";

const router = new Hono<AppEnv>();

// Customer: own orders only (ownerOrAdmin guard applied per route)
router.post("/", (c) => proxyTo("ORDER", c));
router.get("/:id", ownerOrAdmin, (c) => proxyTo("ORDER", c));
router.post("/:id/cancel", ownerOrAdmin, (c) => proxyTo("ORDER", c));

// Admin: all orders
router.get("/", (c) => proxyTo("ORDER", c)); // routeGuard → ADMIN
router.patch("/:id/status", (c) => proxyTo("ORDER", c)); // routeGuard → ADMIN

export default router;

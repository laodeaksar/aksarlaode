import { Hono } from "hono";

import type { AppEnv } from "@/types/context";
import { proxyTo } from "@/proxy/proxy";

const router = new Hono<AppEnv>();

// Midtrans posts here after payment status change
router.post("/midtrans", (c) => proxyTo("PAYMENT", c));

export default router;

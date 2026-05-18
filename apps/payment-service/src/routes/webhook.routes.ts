import { Hono } from "hono";

import { webhookHandler } from "@/handlers/webhook";
import type { AppEnv } from "@/types";

const router = new Hono<AppEnv>();

router.post("/midtrans", webhookHandler);

export default router;

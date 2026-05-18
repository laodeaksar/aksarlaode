import { Hono } from "hono";

import { initiateHandler } from "@/handlers/initiate";
import { statusHandler } from "@/handlers/status";
import type { AppEnv } from "@/types";

const router = new Hono<AppEnv>();

router.post("/", initiateHandler);
router.get("/:orderId/status", statusHandler);

export default router;

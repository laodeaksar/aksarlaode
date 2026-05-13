import { Hono }       from "hono"
import type { AppEnv } from "../types"

const router = new Hono<AppEnv>()

router.get("/", async (c) => {
  return c.json({ message: "Session routes placeholder" })
})

export default router

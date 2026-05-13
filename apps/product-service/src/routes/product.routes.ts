import { Hono }           from "hono"
import { listHandler }    from "@/handlers/list"
import { createHandler }  from "@/handlers/create"
import { getOneHandler }  from "@/handlers/get-one"
import { updateHandler }  from "@/handlers/update"
import { deleteHandler }  from "@/handlers/delete"
import type { AppEnv }    from "@/types"

const router = new Hono<AppEnv>()

router.get("/",     listHandler)
router.post("/",    createHandler)
router.get("/:id",  getOneHandler)
router.put("/:id",  updateHandler)
router.delete("/:id", deleteHandler)

export default router

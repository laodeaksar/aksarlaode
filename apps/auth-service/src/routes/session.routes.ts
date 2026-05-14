import { Elysia }                from "elysia"
import { listSessionsHandler }  from "@/handlers/list-sessions"
import { revokeSessionHandler } from "@/handlers/revoke-session"

const sessionRoutes = new Elysia({ prefix: "/session" })
  .get("/",       listSessionsHandler)
  .delete("/:id", revokeSessionHandler)

export default sessionRoutes

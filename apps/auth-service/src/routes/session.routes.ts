import { Elysia }                from "elysia"
import { listSessionsHandler }  from "@/handlers/list-sessions"
import { revokeSessionHandler } from "@/handlers/revoke-session"
import { SessionQuery }         from "@/schemas"

const sessionRoutes = new Elysia({ prefix: "/session" })
  .get("/",       listSessionsHandler, { query: SessionQuery })
  .delete("/:id", revokeSessionHandler)

export default sessionRoutes

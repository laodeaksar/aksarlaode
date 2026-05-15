import { Elysia }                from "elysia"
import { listSessionsHandler }  from "@/handlers/list-sessions"
import { revokeSessionHandler } from "@/handlers/revoke-session"
import { SessionQuery }         from "@/schemas"

const sessionRoutes = new Elysia({ prefix: "/session" })
  .get("/", listSessionsHandler, {
    query: SessionQuery,
    detail: {
      tags:        ["Sessions"],
      summary:     "List sessions",
      description: "Returns a paginated list of the authenticated user's active sessions, ordered by creation time descending.",
    },
  })
  .delete("/:id", revokeSessionHandler, {
    detail: {
      tags:        ["Sessions"],
      summary:     "Revoke session",
      description: "Invalidates a specific session by ID. Users may only revoke their own sessions.",
    },
  })

export default sessionRoutes

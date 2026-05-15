import { Elysia }                   from "elysia"
import { adminListUsersHandler }     from "@/handlers/admin-users"
import { adminUpdateUserRoleHandler } from "@/handlers/admin-users"
import { AdminUserQuery, UpdateUserRoleBody } from "@/schemas"

const adminRoutes = new Elysia({ prefix: "/admin" })
  // GET /admin/users — paginated user list (minRole: ADMIN via gateway + handler guard)
  .get("/users",              adminListUsersHandler,        { query: AdminUserQuery })

  // PATCH /admin/users/:id/role — role mutation (minRole: OWNER via gateway + handler guard)
  .patch("/users/:id/role",   adminUpdateUserRoleHandler,   { body: UpdateUserRoleBody })

export default adminRoutes

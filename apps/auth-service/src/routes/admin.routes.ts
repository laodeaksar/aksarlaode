import { Elysia }                    from "elysia"
import {
  adminListUsersHandler,
  adminUpdateUserRoleHandler,
  adminDeleteUserHandler,
  adminRestoreUserHandler,
} from "@/handlers/admin-users"
import { AdminUserQuery, UpdateUserRoleBody } from "@/schemas"

const adminRoutes = new Elysia({ prefix: "/admin" })
  // GET /admin/users — paginated list (minRole: ADMIN via gateway + handler guard)
  .get("/users",                adminListUsersHandler,       { query: AdminUserQuery    })

  // PATCH /admin/users/:id/role — role mutation (minRole: OWNER via gateway + handler guard)
  .patch("/users/:id/role",     adminUpdateUserRoleHandler,  { body: UpdateUserRoleBody })

  // DELETE /admin/users/:id — soft-delete + session invalidation (minRole: OWNER)
  .delete("/users/:id",         adminDeleteUserHandler)

  // PATCH /admin/users/:id/restore — recover a soft-deleted user (minRole: OWNER)
  .patch("/users/:id/restore",  adminRestoreUserHandler)

export default adminRoutes

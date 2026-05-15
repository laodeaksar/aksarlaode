import { Elysia }                    from "elysia"
import {
  adminListUsersHandler,
  adminUpdateUserRoleHandler,
  adminDeleteUserHandler,
  adminRestoreUserHandler,
} from "@/handlers/admin-users"
import { AdminUserQuery, UpdateUserRoleBody } from "@/schemas"

const adminRoutes = new Elysia({ prefix: "/admin" })
  .get("/users", adminListUsersHandler, {
    query: AdminUserQuery,
    detail: {
      tags:        ["Admin"],
      summary:     "List users",
      description: "Returns a paginated, role-filterable list of users. Soft-deleted users are excluded by default; pass `?includeDeleted=true` to include them (OWNER only). Requires ADMIN role.",
    },
  })
  .patch("/users/:id/role", adminUpdateUserRoleHandler, {
    body: UpdateUserRoleBody,
    detail: {
      tags:        ["Admin"],
      summary:     "Update user role",
      description: "Changes a user's role to CUSTOMER or ADMIN. OWNER cannot be assigned here — use `POST /auth/owner/transfer` instead. Requires OWNER role.",
    },
  })
  .delete("/users/:id", adminDeleteUserHandler, {
    detail: {
      tags:        ["Admin"],
      summary:     "Soft-delete user",
      description: "Marks the user as deleted (`deletedAt` timestamp set) and immediately invalidates all their sessions. The account is preserved and can be restored. OWNER accounts cannot be deleted. Requires OWNER role.",
    },
  })
  .patch("/users/:id/restore", adminRestoreUserHandler, {
    detail: {
      tags:        ["Admin"],
      summary:     "Restore soft-deleted user",
      description: "Clears the `deletedAt` timestamp, making the account active again. Returns 409 if the user is not currently soft-deleted. Requires OWNER role.",
    },
  })

export default adminRoutes

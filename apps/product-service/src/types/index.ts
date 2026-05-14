export type UserRole = "CUSTOMER" | "ADMIN"

/**
 * Values injected by the withUserContext plugin via `.derive({ as: "global" })`.
 * Intersect with Elysia's Context in handler signatures to get typed access.
 *
 *   async ({ body, set, userRole }: Context & DerivedContext) => { ... }
 */
export type DerivedContext = {
  userId:    string | null
  userRole:  UserRole | null
  requestId: string | null
}

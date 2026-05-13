export type UserRole = "CUSTOMER" | "ADMIN"

export type AppEnv = {
  Variables: {
    userId?: string
    userRole?: UserRole
  }
}

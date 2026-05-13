export type UserRole = "CUSTOMER" | "ADMIN"

export type Session = {
  id:    string
  email: string
  name:  string
  role:  UserRole
}

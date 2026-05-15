export type UserRole = "CUSTOMER" | "ADMIN" | "OWNER"

export type HandlerCtx = {
  body:    unknown
  headers: Record<string, string | undefined>
  set:     { status?: number; headers: Record<string, string> }
  query:   Record<string, string | undefined>
  params:  Record<string, string | undefined>
  request: Request
  store:   Record<string, unknown>
}

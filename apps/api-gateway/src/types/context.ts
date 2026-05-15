export type User = {
  id:        string
  role:      "CUSTOMER" | "ADMIN" | "OWNER" | "SERVICE"
  sessionId: string
}

// Hono's typed context variables
export type AppEnv = {
  Variables: {
    requestId:   string
    startTime:   number
    authPayload: unknown        // raw JWT payload, pre-validation
    user:        User | null    // validated, set by contextInjector
    abortSignal: AbortSignal    // set by requestTimeout, consumed by proxy
  }
}

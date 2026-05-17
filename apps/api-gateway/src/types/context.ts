export type User = {
  id: string
  role: "CUSTOMER" | "ADMIN" | "OWNER" | "SERVICE"
  sessionId: string
  email?: string // injected from JWT claim; absent on tokens issued before this change
}

// Hono's typed context variables
export type AppEnv = {
  Variables: {
    requestId: string
    startTime: number
    authPayload: unknown // raw JWT payload, pre-validation
    user: User | null // validated, set by contextInjector
    abortSignal: AbortSignal // set by requestTimeout, consumed by proxy
    // FIX GW-04: webhook body cached here after HMAC verification so the
    // proxy can forward it without re-reading an already-consumed stream.
    webhookRawBody: string | null
  }
}

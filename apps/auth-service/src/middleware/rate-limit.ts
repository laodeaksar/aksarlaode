interface Entry {
  count:   number
  resetAt: number
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, Entry>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000).unref()

  return ({
    request,
    set,
  }: {
    request: Request
    set:     { status?: number; headers: Record<string, string> }
  }) => {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    const now   = Date.now()
    const entry = store.get(ip)

    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return
    }

    if (entry.count >= maxRequests) {
      set.status                  = 429
      set.headers["Retry-After"]  = String(Math.ceil((entry.resetAt - now) / 1000))
      return { error: "Too many requests, please try again later" }
    }

    entry.count++
  }
}

export const loginRateLimiter          = createRateLimiter(10, 15 * 60 * 1000)
export const registerRateLimiter       = createRateLimiter(5,  60 * 60 * 1000)
export const forgotPasswordRateLimiter = createRateLimiter(5,  60 * 60 * 1000)

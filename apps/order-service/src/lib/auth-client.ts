import { env } from "@repo/env/order"

// Minimal internal client for fetching user profile from auth-service.
// Uses x-service-token so the request bypasses public auth middleware.

type UserProfile = {
  id:    string
  name:  string
  email: string
}

async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(
      `${env.AUTH_SERVICE_URL}/admin/users/${userId}`,
      {
        headers: {
          "x-service-token": env.INTERNAL_SERVICE_TOKEN,
          Accept:            "application/json",
        },
        signal: AbortSignal.timeout(4_000),
      }
    )
    if (!res.ok) return null
    const body = await res.json()
    // auth-service wraps in { data: { ... } } for admin endpoints
    return (body?.data ?? body) as UserProfile
  } catch {
    return null
  }
}

export const authClient = {
  /**
   * Returns the user's email address, or an empty string when auth-service is
   * unavailable.  Callers must treat "" as "unknown — email-worker will retry".
   */
  fetchUserEmail: async (userId: string): Promise<string> => {
    const profile = await getProfile(userId)
    return profile?.email ?? ""
  },
}

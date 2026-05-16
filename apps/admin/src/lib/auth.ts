import { env } from "@repo/env"

// FIX ADM-05: Expanded role type to include OWNER and FINANCE
// (FINANCE was added via migration 006; OWNER via migration 002).
export type UserRole = "CUSTOMER" | "ADMIN" | "OWNER" | "FINANCE"

export type Session = {
  id:    string
  email: string
  name:  string
  role:  UserRole
}

export async function getSession(): Promise<Session | null> {
  try {
    const res = await fetch(`${env.PUBLIC_API_URL}/auth/me`, {
      credentials: "include",
    })
    if (!res.ok) return null
    const body = await res.json()
    return body?.data ?? body ?? null
  } catch {
    return null
  }
}

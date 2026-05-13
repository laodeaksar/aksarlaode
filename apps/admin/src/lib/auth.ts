import { env } from "@repo/env"

export type Session = {
  id:    string
  email: string
  name:  string
  role:  "CUSTOMER" | "ADMIN"
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

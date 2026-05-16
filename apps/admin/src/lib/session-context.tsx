// FIX ADM-05: Session context exposes the current user's role to all child
// components without prop-drilling.  Use the `useSession()` hook to read
// the role and then check permissions via `can()` from rbac.ts.
import React, { createContext, useContext, useEffect, useState } from "react"
import { getSession, type Session } from "@/lib/auth"

type SessionContextValue = {
  session: Session | null
  loading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession()
      .then(setSession)
      .finally(() => setLoading(false))
  }, [])

  return (
    <SessionContext.Provider value={{ session, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)
}

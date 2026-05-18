import { createContext, useContext } from "react";

import type { Session } from "@/lib/auth";

// ── Session Context ─────────────────────────────────────────────────────────
// Seeded server-side from __root.tsx beforeLoad — zero client-side fetch.
// Previously used SessionProvider + useEffect which caused:
//   1. Double /auth/me call per navigation (SSR + client)
//   2. useSession() always returning null on first render → RBAC always false

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
};

export const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: false,
});

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

import { hydrateRoot }         from "react-dom/client"
import { StartClient }          from "@tanstack/react-start/client"
import { QueryClientProvider }  from "@tanstack/react-query"
import { SessionProvider }      from "../src/lib/session-context"
import { createRouter }         from "./router"

// ── Client hydration entry ─────────────────────────────────────────────────
// Called by TanStack Start after the server-rendered HTML arrives.

const router      = createRouter()
const queryClient = router.options.context!.queryClient

// StartClient has a complex generic that TypeScript sometimes can't resolve
// against the concrete router type. The cast to `any` is safe here because
// the router IS an AnyRouter — only the inference fails.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnyStartClient = StartClient as React.ComponentType<{ router: any }>

hydrateRoot(
  document.getElementById("root")!,
  <QueryClientProvider client={queryClient}>
    <SessionProvider>
      <AnyStartClient router={router} />
    </SessionProvider>
  </QueryClientProvider>,
)

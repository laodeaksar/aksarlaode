import { createStartHandler }   from "@tanstack/start-server-core"
import { defaultStreamHandler }  from "@tanstack/react-start/server"

// ── SSR entry point ────────────────────────────────────────────────────────
// TanStack Start calls this module's default export for every server request.
// The router is resolved via the `Register` interface declared in router.tsx.
// `defaultStreamHandler` streams HTML using React's renderToPipeableStream.

export default createStartHandler(defaultStreamHandler)

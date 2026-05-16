import { createMiddleware } from "@tanstack/react-start"
import { ManagedRuntime }   from "effect"
import { AppRuntime }       from "./Runtime"
import type { AppServices } from "./Runtime"

// ── Effect middleware for TanStack Start server functions ──────────────────
//
// Usage — chain `.middleware([effectMiddleware])` onto any server function:
//
//   export const myFn = createServerFn({ method: "GET" })
//     .middleware([effectMiddleware])
//     .handler(async ({ context }) => {
//       return context.runtime.runPromise(
//         Effect.gen(function* () {
//           const api = yield* ApiClientService
//           return yield* api.products.list({})
//         })
//       )
//     })
//
// Benefits over calling runServerEffect() directly:
//   • The runtime is injected once and shared across all handlers in the chain.
//   • Additional middleware (logging, auth, tracing) can be stacked on top.
//   • The context type is fully inferred — no manual type imports needed.
//
// The AppRuntime is a module-level ManagedRuntime singleton — its underlying
// Layer is acquired once and reused across requests, matching the lifecycle of
// the Node.js process.

export type EffectMiddlewareContext = {
  runtime: ManagedRuntime.ManagedRuntime<AppServices, never>
}

export const effectMiddleware = createMiddleware().server(
  async ({ next }) =>
    next({
      context: {
        runtime: AppRuntime,
      } satisfies EffectMiddlewareContext,
    }),
)

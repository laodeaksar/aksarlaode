import { createMiddleware } from "@tanstack/react-start";

import { ManagedRuntime } from "effect";

import { logError, logInfo } from "./Logger";
import { AppRuntime } from "./Runtime";
import type { AppServices } from "./Runtime";

// ── Effect middleware for TanStack Start server functions ──────────────────
//
// Attach to any server function with `.middleware([effectMiddleware])`:
//
//   export const myFn = createServerFn({ method: "GET" })
//     .middleware([effectMiddleware])
//     .inputValidator(decodeOrThrow(MySchema, ...))
//     .handler(async ({ data, context }) =>
//       context.runtime.runPromise(
//         Effect.gen(function* () {
//           const api = yield* ApiClientService
//           return yield* api.products.list({})
//         })
//       )
//     )
//
// What this middleware does (in order):
//
//   1. Records the wall-clock start time via `performance.now()`.
//   2. Injects `AppRuntime` into `context.runtime` so handlers don't need to
//      import or call `runServerEffect` manually.
//   3. Awaits `next()` — all downstream middleware and the handler itself run.
//   4. On success  → emits an INFO log: fn name, file, duration in ms.
//   5. On any throw → emits an ERROR log with the same fields plus a
//      serialised representation of the error (_tag, message, status if any),
//      then re-throws so TanStack Start can return the correct HTTP status.
//
// The AppRuntime is a module-level ManagedRuntime singleton acquired once per
// process — it is NOT re-created per request.

export type EffectMiddlewareContext = {
  runtime: ManagedRuntime.ManagedRuntime<AppServices, never>;
};

export const effectMiddleware = createMiddleware().server(
  async ({ next, serverFnMeta }) => {
    const startMs = performance.now();
    // serverFnMeta is present for server-function calls and absent for plain
    // router requests — guard with fallbacks so the type stays narrowed.
    const fn = serverFnMeta?.name ?? "(unknown)";
    const file = serverFnMeta?.filename ?? "(unknown)";

    try {
      const result = await next({
        context: {
          runtime: AppRuntime,
        } satisfies EffectMiddlewareContext,
      });

      logInfo({
        fn,
        file,
        durationMs: Math.round(performance.now() - startMs),
        status: "ok",
      });

      return result;
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startMs);

      // Serialise the error for structured logging.
      // Effect tagged errors carry `_tag` and `message`; HTTP errors also carry
      // `status`. Fall back gracefully for plain Error instances.
      let errorPayload: Record<string, unknown>;

      if (err !== null && typeof err === "object") {
        const e = err as Record<string, unknown>;
        errorPayload = {
          _tag: typeof e["_tag"] === "string" ? e["_tag"] : "UnknownError",
          message:
            typeof e["message"] === "string" ? e["message"] : String(err),
          ...(typeof e["status"] === "number" ? { status: e["status"] } : {}),
        };
      } else {
        errorPayload = { _tag: "UnknownError", message: String(err) };
      }

      logError({
        fn,
        file,
        durationMs,
        status: "error",
        error: errorPayload,
      });

      // Re-throw — TanStack Start serialises the error and sends it to the client.
      throw err;
    }
  }
);

import { Layer, ManagedRuntime } from "effect";

import { ApiConfigLayer } from "./layers";

// One shared runtime for all server-side and client-side Effect programs.
// Consumers call AppRuntime.runPromiseExit(effect) directly — the typed Exit
// value preserves Effect's error channel so callers can pattern-match on it.
export const AppRuntime = ManagedRuntime.make(ApiConfigLayer);

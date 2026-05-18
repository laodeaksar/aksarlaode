import { Layer, ManagedRuntime } from "effect";

import { ApiConfigLayer } from "./layers";

// One shared runtime for all server-side Effect programs
export const AppRuntime = ManagedRuntime.make(ApiConfigLayer);

// Convenience: run an Effect program and return Result
export async function runEffect<A, E>(
  effect: import("effect").Effect.Effect<A, E>
): Promise<{ data: A; error: null } | { data: null; error: E }> {
  try {
    const data = await AppRuntime.runPromise(effect as any);
    return { data: data as A, error: null };
  } catch (e) {
    return { data: null, error: e as E };
  }
}

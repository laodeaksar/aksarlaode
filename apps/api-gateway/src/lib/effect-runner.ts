import { Effect } from "effect"

export async function runEffect<A, E>(
  effect: Effect.Effect<A, E>
): Promise<A> {
  return Effect.runPromise(effect as any)
}

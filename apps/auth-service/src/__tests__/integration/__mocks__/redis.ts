/**
 * In-memory Redis mock for integration tests.
 *
 * No real Redis connection is required. The mock covers exactly the four
 * Redis primitives used by auth-service:
 *
 *   eval   — sliding-window rate limiter (rate-limit.ts) and per-email
 *             account lockout (account-lockout.ts).  Always returns [1, 0]
 *             which means "1 request in window, 0 ms retry-after" → allowed.
 *
 *   setex  — session denylist write (session-denylist.ts, logout path).
 *   get    — session denylist read (session-denylist.ts).
 *   on     — error handler registration on the Redis client instance.
 */

const store = new Map<string, string>();

export const redis = {
  eval: async (..._args: unknown[]): Promise<[number, number]> => [1, 0],

  setex: async (key: string, _ttl: number, value: string): Promise<"OK"> => {
    store.set(key, value);
    return "OK";
  },

  get: async (key: string): Promise<string | null> => store.get(key) ?? null,

  on: (_event: string, _handler: (...args: unknown[]) => void): void => {},

  quit: async (): Promise<void> => {},
};

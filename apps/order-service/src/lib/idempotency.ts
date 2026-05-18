import { redis } from "@/lib/redis";

// ── Constants ──────────────────────────────────────────────────────────────
const KEY_PREFIX = "idempotency:order:";
const LOCK_TTL = 30; // seconds — max in-flight duration before lock expires
const RESULT_TTL = 86_400; // seconds — 24 h result cache

// ── Types ──────────────────────────────────────────────────────────────────
export type IdempotencyResult = { status: number; body: unknown };

type IdempotencyState =
  | { state: "hit"; result: IdempotencyResult } // cached result exists
  | { state: "pending" } // another request in-flight
  | { state: "free" }; // new key, proceed normally

// ── Implementation ─────────────────────────────────────────────────────────
export const idempotency = {
  /**
   * Atomically checks the idempotency key and acquires a lock if not taken.
   *
   * "hit"     → A completed result is cached. Return it immediately (no side effects).
   * "pending" → Another request with this key is currently in-flight. Return 409.
   * "free"    → First time seeing this key. A "PENDING" lock has been set. Proceed
   *             normally and call complete() or fail() when done.
   */
  getOrLock: async (key: string): Promise<IdempotencyState> => {
    const raw = await redis.get(KEY_PREFIX + key);

    if (raw === "PENDING") return { state: "pending" };
    if (raw !== null)
      return { state: "hit", result: JSON.parse(raw) as IdempotencyResult };

    // Atomic SETNX — only one concurrent caller wins the lock
    const claimed = await redis.set(
      KEY_PREFIX + key,
      "PENDING",
      "EX",
      LOCK_TTL,
      "NX"
    );
    return claimed ? { state: "free" } : { state: "pending" };
  },

  /**
   * Persist the final result and overwrite the PENDING lock.
   * Call this after a successful order creation.
   */
  complete: async (key: string, result: IdempotencyResult): Promise<void> => {
    await redis.set(KEY_PREFIX + key, JSON.stringify(result), "EX", RESULT_TTL);
  },

  /**
   * Release the PENDING lock without storing a result.
   * Call this when order creation fails so the client can retry.
   */
  fail: async (key: string): Promise<void> => {
    await redis.del(KEY_PREFIX + key);
  },
};

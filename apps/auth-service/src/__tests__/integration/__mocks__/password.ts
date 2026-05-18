/**
 * Fast password mock for integration tests.
 *
 * The Argon2id native bindings are compiled for the Bun runtime and are
 * not available under the Node.js Vitest runner.  This mock replaces the
 * production password module with a deterministic SHA-256 implementation
 * so the register → login flow can be exercised end-to-end without native
 * bindings.
 *
 * Security note: SHA-256 is NOT a suitable password hash for production.
 * This file is only ever imported via the vitest.integration.config.ts alias.
 */
import { createHash } from "node:crypto";

import { Effect } from "effect";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function hashPassword(password: string) {
  return Effect.sync(() => `sha256:${sha256Hex(password)}`);
}

export function verifyPassword(password: string, hash: string) {
  return Effect.sync(() => hash === `sha256:${sha256Hex(password)}`);
}

export function needsRehash(_hash: string) {
  return Effect.succeed(false);
}

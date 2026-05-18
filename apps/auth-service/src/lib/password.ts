import { Data, Effect } from "effect";

class HashError extends Data.TaggedError("HashError") {}
class VerifyError extends Data.TaggedError("VerifyError") {}

/**
 * Hash a password using Argon2id via Bun's built-in API.
 * Returns a self-describing PHC string: $argon2id$v=19$m=65536,t=3,p=4$...
 *
 * Parameters chosen to align with OWASP 2024 recommendations:
 *   memoryCost 65536 (64 MB) — dominates GPU throughput
 *   timeCost   3            — additional time-hardening on top of memory
 */
export const hashPassword = (plain: string): Effect.Effect<string, HashError> =>
  Effect.tryPromise({
    try: () =>
      Bun.password.hash(plain, {
        algorithm: "argon2id",
        memoryCost: 65536,
        timeCost: 3,
      }),
    catch: () => new HashError(),
  });

/**
 * Verify a password against a stored hash.
 *
 * Supports two formats transparently:
 *   Argon2id   PHC string ($argon2id$...) — handled by Bun.password.verify()
 *   Legacy PBKDF2 hex:hex format          — custom WebCrypto path
 *
 * After a successful verification of a legacy hash, call needsRehash() and
 * upgrade to Argon2id on the next opportunity (e.g., inside loginHandler).
 */
export const verifyPassword = (
  plain: string,
  stored: string
): Effect.Effect<boolean, VerifyError> =>
  Effect.tryPromise({
    try: async () => {
      if (isArgon2Hash(stored)) {
        return Bun.password.verify(plain, stored);
      }
      return verifyLegacyPbkdf2(plain, stored);
    },
    catch: () => new VerifyError(),
  });

/**
 * Returns true when the stored hash was produced by the legacy PBKDF2 path
 * and should be upgraded to Argon2id on the next successful authentication.
 * Detection is O(1): the PHC format always begins with '$argon2'.
 */
export const needsRehash = (stored: string): boolean => !isArgon2Hash(stored);

// ── Format detection ──────────────────────────────────────────────────────────

const isArgon2Hash = (s: string): boolean => s.startsWith("$argon2");

// ── Legacy PBKDF2-HMAC-SHA256 path (kept for migration, not for new hashes) ──

async function verifyLegacyPbkdf2(
  plain: string,
  stored: string
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = unhex(saltHex);
  const key = await derivePbkdf2Key(plain, salt);
  const candidate = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  return constantTimeEqual(hex(candidate), hashHex);
}

async function derivePbkdf2Key(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );
}

const hex = (b: Uint8Array) =>
  [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) =>
  new Uint8Array(s.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

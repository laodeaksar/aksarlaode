import { Data, Effect } from "effect";

import { env } from "@repo/env/auth";

class TokenError extends Data.TaggedError("TokenError")<{ reason: string }> {}

export type TokenPair = { accessToken: string; refreshToken: string };

/**
 * Issues an access token (signed with JWT_ACCESS_PRIVATE_KEY, 15 min) and a
 * refresh token (signed with JWT_REFRESH_PRIVATE_KEY, 7 days).
 *
 * Algorithm: EdDSA (Ed25519).
 *   — Auth-service holds the private keys and is the only entity that can sign.
 *   — Api-gateway verifies access tokens using JWT_ACCESS_PUBLIC_KEY only;
 *     a compromised gateway cannot forge tokens.
 *
 * Both tokens carry a `type` claim ("access" / "refresh") to prevent
 * cross-type token substitution attacks.
 */
export const issueTokenPair = (
  userId: string,
  role: string,
  sessionId: string,
  email: string
): Effect.Effect<TokenPair, TokenError> =>
  Effect.gen(function* () {
    const accessToken = yield* signToken(
      { sub: userId, role, sessionId, email, type: "access" },
      60 * 5, // 5 min — reduced from 15 min to shorten the post-logout revocation window
      env.JWT_ACCESS_PRIVATE_KEY
    );
    const refreshToken = yield* signToken(
      { sub: userId, type: "refresh" },
      60 * 60 * 24 * 7,
      env.JWT_REFRESH_PRIVATE_KEY
    );
    return { accessToken, refreshToken };
  });

/**
 * Verifies a JWT and returns its payload.
 *
 * `expectedType` selects the correct Ed25519 public key and asserts that the
 * token's `type` claim matches — preventing a 7-day refresh token from being
 * accepted where a 15-minute access token is expected.
 *
 * Also validates:
 *  — alg header must be "EdDSA"
 *  — signature over header.payload bytes
 *  — exp claim (not missing, not expired)
 *  — type claim (matches expectedType)
 */
export const verifyToken = (
  token: string,
  expectedType: "access" | "refresh"
): Effect.Effect<Record<string, unknown>, TokenError> =>
  Effect.tryPromise({
    try: async () => {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Invalid token format");
      const [header, body, sig] = parts as [string, string, string];

      // ── 1. Validate alg header ──────────────────────────────────────────────
      const headerObj = JSON.parse(
        atob(header.replace(/-/g, "+").replace(/_/g, "/"))
      ) as Record<string, unknown>;

      if (headerObj["alg"] !== "EdDSA") {
        throw new Error(
          `Unexpected algorithm: ${String(headerObj["alg"] ?? "missing")}`
        );
      }

      // ── 2. Verify Ed25519 signature ─────────────────────────────────────────
      const publicKeyB64 =
        expectedType === "access"
          ? env.JWT_ACCESS_PUBLIC_KEY
          : env.JWT_REFRESH_PUBLIC_KEY;

      const key = await importPublicKey(publicKeyB64);

      const sigBytes = fromBase64url(sig);
      const data = new TextEncoder().encode(`${header}.${body}`);

      const valid = await crypto.subtle.verify("Ed25519", key, sigBytes, data);
      if (!valid) throw new Error("Invalid signature");

      // ── 3. Decode and validate payload ──────────────────────────────────────
      const payload = JSON.parse(
        atob(body.replace(/-/g, "+").replace(/_/g, "/"))
      ) as Record<string, unknown>;

      if (typeof payload["exp"] !== "number") {
        throw new Error("Token missing expiry claim");
      }
      if (payload["exp"] < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }
      if (payload["type"] !== expectedType) {
        throw new Error(
          `Token type mismatch: expected "${expectedType}" but got "${String(payload["type"] ?? "unknown")}"`
        );
      }

      return payload;
    },
    catch: (e) => new TokenError({ reason: String(e) }),
  });

// ── Private helpers ───────────────────────────────────────────────────────────

const signToken = (
  claims: Record<string, unknown>,
  expiresInSeconds: number,
  privateKeyB64: string
): Effect.Effect<string, TokenError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await importPrivateKey(privateKeyB64);
      const now = Math.floor(Date.now() / 1000);
      const payload = { ...claims, iat: now, exp: now + expiresInSeconds };
      const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
      const body = b64url(JSON.stringify(payload));
      const data = new TextEncoder().encode(`${header}.${body}`);
      const sigBuf = await crypto.subtle.sign("Ed25519", key, data);
      return `${header}.${body}.${b64url(sigBuf)}`;
    },
    catch: (e) => new TokenError({ reason: String(e) }),
  });

async function importPrivateKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    fromBase64(b64),
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    fromBase64(b64),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

/** Decode standard base64 (used for DER-encoded keys stored in env vars). */
const fromBase64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Decode base64url (used for JWT signature segments). */
const fromBase64url = (b64url: string): Uint8Array =>
  fromBase64(b64url.replace(/-/g, "+").replace(/_/g, "/"));

/** Encode to base64url (no padding). */
const b64url = (input: string | ArrayBuffer): string =>
  btoa(
    typeof input === "string"
      ? input
      : String.fromCharCode(...new Uint8Array(input))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

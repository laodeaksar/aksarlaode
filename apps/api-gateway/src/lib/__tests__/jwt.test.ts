import { beforeAll, describe, expect, test } from "bun:test";
import { Effect } from "effect";

// ── Key material — generated once per test run ────────────────────────────────
let privateKey: CryptoKey;
let publicKeyB64: string; // SPKI DER, base64 — same format jwt.ts expects

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  privateKey = pair.privateKey;

  const spkiDer = await crypto.subtle.exportKey("spki", pair.publicKey);
  publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(spkiDer)));
});

// ── Mock env BEFORE importing jwt.ts ─────────────────────────────────────────
// mock.module is hoisted by bun:test so it runs before any import resolution.
mock.module("@repo/env/gateway", () => {
  // The factory is called lazily — by then beforeAll has already set publicKeyB64.
  // We use a getter so the mock always returns the current value of publicKeyB64.
  return {
    get env() {
      return { JWT_ACCESS_PUBLIC_KEY: publicKeyB64 };
    },
  };
});

const { verifyJwt } = await import("../jwt");

// ── JWT helpers ───────────────────────────────────────────────────────────────
function b64url(str: string): string {
  return btoa(str)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function signToken(payload: object): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sigBuf = await crypto.subtle.sign("Ed25519", privateKey, data);
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

function futureExp(secondsFromNow = 3600): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

function pastExp(secondsAgo = 3600): number {
  return Math.floor(Date.now() / 1000) - secondsAgo;
}

const validClaims = {
  sub: "user-123",
  role: "CUSTOMER" as const,
  sessionId: "sess-abc",
  email: "user@example.com",
  iat: Math.floor(Date.now() / 1000),
  exp: futureExp(),
};

// ── Success path ──────────────────────────────────────────────────────────────
describe("verifyJwt — success path", () => {
  test("verifies a valid EdDSA token and returns typed User", async () => {
    const token = await signToken(validClaims);
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.id).toBe("user-123");
      expect(exit.value.role).toBe("CUSTOMER");
      expect(exit.value.sessionId).toBe("sess-abc");
      expect(exit.value.email).toBe("user@example.com");
    }
  });

  test("omits email field when not present in claims", async () => {
    const { email: _email, ...claimsWithoutEmail } = validClaims;
    const token = await signToken(claimsWithoutEmail);
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.email).toBeUndefined();
    }
  });

  test("accepts ADMIN role token", async () => {
    const token = await signToken({ ...validClaims, role: "ADMIN" });
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Success");
    if (exit._tag === "Success") {
      expect(exit.value.role).toBe("ADMIN");
    }
  });
});

// ── TokenMalformedError ───────────────────────────────────────────────────────
describe("verifyJwt — TokenMalformedError", () => {
  async function expectMalformed(token: string) {
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string } }).error;
      expect(err._tag).toBe("TokenMalformedError");
    }
  }

  test("rejects an empty string", () => expectMalformed(""));
  test("rejects a token with only two parts", () => expectMalformed("a.b"));
  test("rejects a token with four parts", () => expectMalformed("a.b.c.d"));
  test("rejects non-base64 header", () => expectMalformed("!!!.b.c"));
});

// ── TokenInvalidError ─────────────────────────────────────────────────────────
describe("verifyJwt — TokenInvalidError", () => {
  test("unexpected_algorithm — rejects RS256 header", async () => {
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const body = b64url(JSON.stringify(validClaims));
    const token = `${header}.${body}.fakesig`;
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } }).error;
      expect(err._tag).toBe("TokenInvalidError");
      expect(err.reason).toBe("unexpected_algorithm");
    }
  });

  test("bad_signature — rejects token signed with a different key", async () => {
    // Generate a second, unrelated key pair and sign with it
    const otherPair = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]);
    const token = await (async () => {
      const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
      const body = b64url(JSON.stringify(validClaims));
      const data = new TextEncoder().encode(`${header}.${body}`);
      const sigBuf = await crypto.subtle.sign("Ed25519", otherPair.privateKey, data);
      const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
      return `${header}.${body}.${sig}`;
    })();

    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } }).error;
      expect(err._tag).toBe("TokenInvalidError");
      expect(err.reason).toBe("bad_signature");
    }
  });

  test("missing_claims — rejects token without sessionId", async () => {
    const { sessionId: _sid, ...claims } = validClaims;
    const token = await signToken(claims);
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } }).error;
      expect(err._tag).toBe("TokenInvalidError");
      expect(err.reason).toBe("missing_claims");
    }
  });

  test("missing_claims — rejects token without sub", async () => {
    const { sub: _sub, ...claims } = validClaims;
    const token = await signToken(claims);
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } }).error;
      expect(err._tag).toBe("TokenInvalidError");
      expect(err.reason).toBe("missing_claims");
    }
  });
});

// ── TokenExpiredError ─────────────────────────────────────────────────────────
describe("verifyJwt — TokenExpiredError", () => {
  test("rejects a token whose exp is in the past", async () => {
    const token = await signToken({ ...validClaims, exp: pastExp(3600) });
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string } }).error;
      expect(err._tag).toBe("TokenExpiredError");
    }
  });

  test("accepts a token that expires exactly 1 second from now", async () => {
    const token = await signToken({ ...validClaims, exp: futureExp(1) });
    const exit = await Effect.runPromiseExit(verifyJwt(token));
    expect(exit._tag).toBe("Success");
  });
});

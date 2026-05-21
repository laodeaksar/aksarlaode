import { Effect } from "effect";

import { describe, expect, test } from "bun:test";

// ── Mock env with a known server key ──────────────────────────────────────────
const TEST_SERVER_KEY = "test-midtrans-server-key-for-unit-testing";

mock.module("@repo/env/gateway", () => ({
  env: {
    MIDTRANS_SERVER_KEY: TEST_SERVER_KEY,
  },
}));

const { verifyHmac } = await import("../hmac");

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sha512hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeValidSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
}): Promise<string> {
  const input = `${payload.order_id}${payload.status_code}${payload.gross_amount}${TEST_SERVER_KEY}`;
  return sha512hex(input);
}

const basePayload = {
  order_id: "ORDER-001",
  status_code: "200",
  gross_amount: "150000.00",
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("verifyHmac — success path", () => {
  test("resolves for a correctly signed payload", async () => {
    const sig = await makeValidSignature(basePayload);
    const body = JSON.stringify(basePayload);
    const exit = await Effect.runPromiseExit(verifyHmac(body, sig));
    expect(exit._tag).toBe("Success");
  });

  test("accepts payloads with extra fields (passthrough)", async () => {
    const payloadWithExtras = {
      ...basePayload,
      transaction_status: "settlement",
      currency: "IDR",
    };
    const sig = await makeValidSignature(basePayload);
    const body = JSON.stringify(payloadWithExtras);
    const exit = await Effect.runPromiseExit(verifyHmac(body, sig));
    expect(exit._tag).toBe("Success");
  });
});

describe("verifyHmac — HmacMissingError", () => {
  test("fails when signature is an empty string", async () => {
    const body = JSON.stringify(basePayload);
    const exit = await Effect.runPromiseExit(verifyHmac(body, ""));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string } }).error;
      expect(err._tag).toBe("HmacMissingError");
    }
  });
});

describe("verifyHmac — HmacInvalidError", () => {
  test("body_parse_failed — rejects non-JSON body", async () => {
    const exit = await Effect.runPromiseExit(
      verifyHmac("not-valid-json{{", "any-signature")
    );
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } })
        .error;
      expect(err._tag).toBe("HmacInvalidError");
      expect(err.reason).toBe("body_parse_failed");
    }
  });

  test("signature_mismatch — fails when signature is wrong", async () => {
    const body = JSON.stringify(basePayload);
    const exit = await Effect.runPromiseExit(
      verifyHmac(body, "a".repeat(128)) // wrong 128-char hex string
    );
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } })
        .error;
      expect(err._tag).toBe("HmacInvalidError");
      expect(err.reason).toBe("signature_mismatch");
    }
  });

  test("signature_mismatch — correct format but wrong server key", async () => {
    // Build a valid sig but with the WRONG server key
    const wrongSig = await sha512hex(
      `${basePayload.order_id}${basePayload.status_code}${basePayload.gross_amount}WRONG_KEY`
    );
    const body = JSON.stringify(basePayload);
    const exit = await Effect.runPromiseExit(verifyHmac(body, wrongSig));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const err = (exit.cause as { error: { _tag: string; reason: string } })
        .error;
      expect(err.reason).toBe("signature_mismatch");
    }
  });

  test("signature_mismatch — tampered order_id is detected", async () => {
    const sig = await makeValidSignature(basePayload);
    // Tamper the body after signing
    const tamperedBody = JSON.stringify({
      ...basePayload,
      order_id: "ORDER-TAMPERED",
    });
    const exit = await Effect.runPromiseExit(verifyHmac(tamperedBody, sig));
    expect(exit._tag).toBe("Failure");
  });

  test("signature_mismatch — tampered gross_amount is detected", async () => {
    const sig = await makeValidSignature(basePayload);
    const tamperedBody = JSON.stringify({
      ...basePayload,
      gross_amount: "1.00",
    });
    const exit = await Effect.runPromiseExit(verifyHmac(tamperedBody, sig));
    expect(exit._tag).toBe("Failure");
  });
});

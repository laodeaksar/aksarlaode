import { describe, it, expect } from "vitest"
import { Effect }               from "effect"
import { hashPassword, verifyPassword, needsRehash } from "@/lib/password"

describe("hashPassword", () => {
  it("returns an Argon2id PHC string", async () => {
    const result = await Effect.runPromise(hashPassword("secret123"))
    expect(result).toMatch(/^\$argon2id\$/)
  })

  it("produces different hashes for the same password (random salt)", async () => {
    const [h1, h2] = await Promise.all([
      Effect.runPromise(hashPassword("secret123")),
      Effect.runPromise(hashPassword("secret123")),
    ])
    expect(h1).not.toBe(h2)
  })
})

describe("verifyPassword — Argon2id (current format)", () => {
  it("returns true for the correct password", async () => {
    const hash  = await Effect.runPromise(hashPassword("mypassword"))
    const valid = await Effect.runPromise(verifyPassword("mypassword", hash))
    expect(valid).toBe(true)
  })

  it("returns false for the wrong password", async () => {
    const hash  = await Effect.runPromise(hashPassword("mypassword"))
    const valid = await Effect.runPromise(verifyPassword("wrongpassword", hash))
    expect(valid).toBe(false)
  })

  it("is case-sensitive", async () => {
    const hash  = await Effect.runPromise(hashPassword("Secret"))
    const valid = await Effect.runPromise(verifyPassword("secret", hash))
    expect(valid).toBe(false)
  })
})

describe("verifyPassword — legacy PBKDF2 (migration path)", () => {
  // Build a real PBKDF2 hash inline — same algorithm as the old hashPassword
  async function legacyHash(plain: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const base = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits", "deriveKey"]
    )
    const key  = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      base,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      true, ["sign"]
    )
    const raw    = new Uint8Array(await crypto.subtle.exportKey("raw", key))
    const toHex  = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2,"0")).join("")
    return `${toHex(salt)}:${toHex(raw)}`
  }

  it("verifies a legacy PBKDF2 hash correctly", async () => {
    const stored = await legacyHash("oldpassword")
    const valid  = await Effect.runPromise(verifyPassword("oldpassword", stored))
    expect(valid).toBe(true)
  })

  it("rejects the wrong password against a legacy hash", async () => {
    const stored = await legacyHash("oldpassword")
    const valid  = await Effect.runPromise(verifyPassword("wrong", stored))
    expect(valid).toBe(false)
  })

  it("returns false for a malformed stored hash", async () => {
    const valid = await Effect.runPromise(verifyPassword("password", "notahash"))
    expect(valid).toBe(false)
  })
})

describe("needsRehash", () => {
  it("returns false for an Argon2id PHC hash", async () => {
    const hash = await Effect.runPromise(hashPassword("test"))
    expect(needsRehash(hash)).toBe(false)
  })

  it("returns true for a legacy PBKDF2 hex:hex hash", () => {
    const legacyHash = "a".repeat(32) + ":" + "b".repeat(64)
    expect(needsRehash(legacyHash)).toBe(true)
  })

  it("returns true for any string not starting with $argon2", () => {
    expect(needsRehash("salt:hash")).toBe(true)
    expect(needsRehash("bcrypt-but-missing-dollar")).toBe(true)
  })
})

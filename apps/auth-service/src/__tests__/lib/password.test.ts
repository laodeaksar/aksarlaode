import { describe, it, expect } from "vitest"
import { Effect }               from "effect"
import { hashPassword, verifyPassword } from "@/lib/password"

describe("password", () => {
  describe("hashPassword", () => {
    it("returns a 'salt:hash' string", async () => {
      const result = await Effect.runPromise(hashPassword("secret123"))
      const parts  = result.split(":")
      expect(parts).toHaveLength(2)
      expect(parts[0]).toHaveLength(32)   // 16-byte salt hex
      expect(parts[1]).toHaveLength(64)   // 32-byte hash hex
    })

    it("produces different hashes for the same password (random salt)", async () => {
      const [h1, h2] = await Promise.all([
        Effect.runPromise(hashPassword("secret123")),
        Effect.runPromise(hashPassword("secret123")),
      ])
      expect(h1).not.toBe(h2)
    })
  })

  describe("verifyPassword", () => {
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

    it("returns false for a malformed stored hash", async () => {
      const valid = await Effect.runPromise(verifyPassword("password", "notahash"))
      expect(valid).toBe(false)
    })

    it("is case-sensitive", async () => {
      const hash  = await Effect.runPromise(hashPassword("Secret"))
      const valid = await Effect.runPromise(verifyPassword("secret", hash))
      expect(valid).toBe(false)
    })
  })
})

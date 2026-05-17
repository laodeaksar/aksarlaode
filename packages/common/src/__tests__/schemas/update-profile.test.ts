import { describe, expect, it } from "vitest"

import { UpdateProfileSchema } from "../../schemas/index"

/**
 * Tests for UpdateProfileSchema — specifically the avatarUrl domain allowlist.
 *
 * This schema is the shared Zod definition consumed by all services.  Adding
 * domain validation here ensures every service rejects disallowed avatar URLs
 * at the boundary, before any handler logic runs.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the first error message for `avatarUrl`, or null if field is valid. */
function avatarError(avatarUrl: string): string | null {
  const result = UpdateProfileSchema.safeParse({ avatarUrl })
  if (result.success) return null
  const issue = result.error.issues.find(
    (i) => Array.isArray(i.path) && i.path.includes("avatarUrl")
  )
  return issue?.message ?? null
}

/** Returns true when the schema accepts the given avatarUrl. */
function avatarAccepted(avatarUrl: string): boolean {
  return UpdateProfileSchema.safeParse({ avatarUrl }).success
}

// ── Allowed domains ───────────────────────────────────────────────────────────

describe("UpdateProfileSchema — avatarUrl — allowed domains", () => {
  it.each([
    "https://gravatar.com/avatar/abc123",
    "https://www.gravatar.com/avatar/xyz?s=200",
    "https://ui-avatars.com/api/?name=Alice",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
    "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    "https://images.unsplash.com/photo-123?w=100",
    "https://cdn.jsdelivr.net/npm/avatar/img.png",
    "https://lh3.googleusercontent.com/a/photo=s100",
    "https://avatars.githubusercontent.com/u/1234?v=4",
  ])("accepts %s", (url) => {
    expect(avatarAccepted(url)).toBe(true)
  })

  it("accepts a profile with no avatarUrl (field is optional)", () => {
    expect(UpdateProfileSchema.safeParse({ name: "Alice" }).success).toBe(true)
  })

  it("accepts a profile with undefined avatarUrl", () => {
    expect(
      UpdateProfileSchema.safeParse({ name: "Alice", avatarUrl: undefined })
        .success
    ).toBe(true)
  })
})

// ── Domain allowlist enforcement ──────────────────────────────────────────────

describe("UpdateProfileSchema — avatarUrl — rejects disallowed domains", () => {
  it("rejects an arbitrary external domain", () => {
    expect(avatarAccepted("https://attacker.example.com/evil.png")).toBe(false)
  })

  it("produces a helpful error message naming the constraint", () => {
    const msg = avatarError("https://attacker.example.com/evil.png")
    expect(msg).toMatch(
      /avatarUrl must be an HTTPS URL from an allowed domain/i
    )
  })

  it("error message lists the allowed hosts", () => {
    const msg = avatarError("https://attacker.example.com/evil.png")
    expect(msg).toMatch(/gravatar\.com/i)
  })

  it("rejects a subdomain of an allowed domain (exact-match only)", () => {
    expect(avatarAccepted("https://evil.gravatar.com/avatar")).toBe(false)
  })

  it("rejects a domain that ends with an allowed domain as its TLD", () => {
    expect(avatarAccepted("https://gravatar.com.attacker.net/img.png")).toBe(
      false
    )
  })
})

// ── Scheme enforcement ────────────────────────────────────────────────────────

describe("UpdateProfileSchema — avatarUrl — rejects non-HTTPS schemes", () => {
  it("rejects http (plain text transport)", () => {
    expect(avatarAccepted("http://gravatar.com/avatar/abc")).toBe(false)
  })

  it("rejects data URI", () => {
    expect(avatarAccepted("data:image/png;base64,abc123==")).toBe(false)
  })

  it("rejects javascript scheme", () => {
    expect(avatarAccepted("javascript:alert(1)")).toBe(false)
  })
})

// ── SSRF prevention ───────────────────────────────────────────────────────────

describe("UpdateProfileSchema — avatarUrl — SSRF prevention", () => {
  it.each([
    ["localhost", "https://localhost/internal"],
    ["127.0.0.1", "https://127.0.0.1/secret"],
    ["RFC-1918 class A", "https://10.0.0.1/admin"],
    ["RFC-1918 class C", "https://192.168.1.1/router"],
    ["AWS metadata", "https://169.254.169.254/latest/meta-data/"],
    ["GCP metadata", "https://metadata.google.internal/computeMetadata/v1/"],
  ])("rejects %s: %s", (_, url) => {
    expect(avatarAccepted(url)).toBe(false)
  })
})

// ── Malformed input ───────────────────────────────────────────────────────────

describe("UpdateProfileSchema — avatarUrl — malformed input", () => {
  it("rejects empty string", () => {
    expect(avatarAccepted("")).toBe(false)
  })

  it("rejects plain text", () => {
    expect(avatarAccepted("not a url")).toBe(false)
  })

  it("rejects a string exceeding maxLength (501 chars)", () => {
    const long = "https://gravatar.com/" + "a".repeat(481)
    expect(avatarAccepted(long)).toBe(false)
  })
})

// ── Object-level guard: at-least-one-field ────────────────────────────────────

describe("UpdateProfileSchema — at least one field required", () => {
  it("rejects an empty object", () => {
    expect(UpdateProfileSchema.safeParse({}).success).toBe(false)
  })

  it("accepts an object with only phone", () => {
    expect(UpdateProfileSchema.safeParse({ phone: "+6281234" }).success).toBe(
      true
    )
  })
})

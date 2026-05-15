import { describe, it, expect } from "vitest"
import { maskEmail } from "@/lib/pii"

describe("maskEmail", () => {
  it("masks a standard email preserving first char and domain", () => {
    expect(maskEmail("john.doe@example.com")).toBe("j****@example.com")
  })

  it("masks a short local part", () => {
    // local = "ab" (length 2) → 1 visible char + 1 star
    expect(maskEmail("ab@example.com")).toBe("a*@example.com")
  })

  it("masks a single-char local part", () => {
    expect(maskEmail("a@example.com")).toBe("a*@example.com")
  })

  it("caps stars at 4 regardless of local part length", () => {
    // long local: "verylongname" → "v****@..."
    const result = maskEmail("verylongname@example.com")
    expect(result).toBe("v****@example.com")
  })

  it("preserves the full domain", () => {
    const result = maskEmail("user@sub.domain.co.uk")
    expect(result).toContain("@sub.domain.co.uk")
  })

  it("returns ***@*** for an email with no @ symbol", () => {
    expect(maskEmail("notanemail")).toBe("***@***")
  })

  it("returns ***@*** for an email starting with @", () => {
    expect(maskEmail("@example.com")).toBe("***@***")
  })

  it("does not include the full original email in the output", () => {
    const email  = "secret.user@company.com"
    const masked = maskEmail(email)
    expect(masked).not.toBe(email)
    expect(masked).not.toContain("secret.user")
  })
})

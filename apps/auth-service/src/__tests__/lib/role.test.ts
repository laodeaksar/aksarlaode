import { describe, expect, it } from "vitest"

import {
  canManage,
  hasMinRole,
  isAtLeastAdmin,
  isAtLeastOwner,
  isOwner,
  ROLE_LEVEL,
} from "@/lib/role"

describe("ROLE_LEVEL — numeric ordering", () => {
  it("OWNER > ADMIN > CUSTOMER", () => {
    expect(ROLE_LEVEL.OWNER).toBeGreaterThan(ROLE_LEVEL.ADMIN)
    expect(ROLE_LEVEL.ADMIN).toBeGreaterThan(ROLE_LEVEL.CUSTOMER)
  })
})

describe("hasMinRole", () => {
  it("OWNER satisfies every role level", () => {
    expect(hasMinRole("OWNER", "CUSTOMER")).toBe(true)
    expect(hasMinRole("OWNER", "ADMIN")).toBe(true)
    expect(hasMinRole("OWNER", "OWNER")).toBe(true)
  })

  it("ADMIN satisfies CUSTOMER and ADMIN but not OWNER", () => {
    expect(hasMinRole("ADMIN", "CUSTOMER")).toBe(true)
    expect(hasMinRole("ADMIN", "ADMIN")).toBe(true)
    expect(hasMinRole("ADMIN", "OWNER")).toBe(false)
  })

  it("CUSTOMER satisfies only CUSTOMER", () => {
    expect(hasMinRole("CUSTOMER", "CUSTOMER")).toBe(true)
    expect(hasMinRole("CUSTOMER", "ADMIN")).toBe(false)
    expect(hasMinRole("CUSTOMER", "OWNER")).toBe(false)
  })
})

describe("isOwner", () => {
  it("returns true only for OWNER", () => {
    expect(isOwner("OWNER")).toBe(true)
    expect(isOwner("ADMIN")).toBe(false)
    expect(isOwner("CUSTOMER")).toBe(false)
  })
})

describe("isAtLeastAdmin", () => {
  it("returns true for ADMIN and OWNER", () => {
    expect(isAtLeastAdmin("ADMIN")).toBe(true)
    expect(isAtLeastAdmin("OWNER")).toBe(true)
  })

  it("returns false for CUSTOMER", () => {
    expect(isAtLeastAdmin("CUSTOMER")).toBe(false)
  })
})

describe("isAtLeastOwner", () => {
  it("returns true only for OWNER", () => {
    expect(isAtLeastOwner("OWNER")).toBe(true)
    expect(isAtLeastOwner("ADMIN")).toBe(false)
    expect(isAtLeastOwner("CUSTOMER")).toBe(false)
  })
})

describe("canManage — privilege escalation prevention", () => {
  it("OWNER can manage ADMIN", () => {
    expect(canManage("OWNER", "ADMIN")).toBe(true)
  })

  it("OWNER can manage CUSTOMER", () => {
    expect(canManage("OWNER", "CUSTOMER")).toBe(true)
  })

  it("OWNER cannot manage another OWNER", () => {
    expect(canManage("OWNER", "OWNER")).toBe(false)
  })

  it("ADMIN can manage CUSTOMER", () => {
    expect(canManage("ADMIN", "CUSTOMER")).toBe(true)
  })

  it("ADMIN cannot manage OWNER — critical privilege escalation guard", () => {
    expect(canManage("ADMIN", "OWNER")).toBe(false)
  })

  it("ADMIN cannot manage another ADMIN", () => {
    expect(canManage("ADMIN", "ADMIN")).toBe(false)
  })

  it("CUSTOMER cannot manage anyone", () => {
    expect(canManage("CUSTOMER", "CUSTOMER")).toBe(false)
    expect(canManage("CUSTOMER", "ADMIN")).toBe(false)
    expect(canManage("CUSTOMER", "OWNER")).toBe(false)
  })
})

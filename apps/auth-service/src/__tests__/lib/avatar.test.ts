import { describe, it, expect } from "vitest"
import { isAllowedAvatarUrl }   from "@/lib/avatar"

/**
 * Unit tests for isAllowedAvatarUrl.
 *
 * These tests are isolated from the handler so the allowlist logic can be
 * verified independently.  The vitest alias redirects @repo/env/auth to the
 * static mock (WEB_URL=http://localhost:3000, ADMIN_URL=http://localhost:3001).
 *
 * Note on localhost: even though localhost appears in appAllowedHosts() via
 * the test mock, BLOCKED_HOSTNAMES takes priority and blocks it — this is
 * intentional and tested below.
 */

describe("isAllowedAvatarUrl", () => {
  // ── Allowed: trusted CDN / avatar domains ────────────────────────────────────

  describe("allows HTTPS URLs from the static allowlist", () => {
    it.each([
      "https://gravatar.com/avatar/abc123",
      "https://www.gravatar.com/avatar/xyz?s=200",
      "https://ui-avatars.com/api/?name=Alice&size=128",
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      "https://images.unsplash.com/photo-123?w=100&fit=crop",
      "https://cdn.jsdelivr.net/npm/avatar-image/img.png",
      "https://lh3.googleusercontent.com/a/photo=s100",
      "https://avatars.githubusercontent.com/u/1234?v=4",
    ])("allows %s", (url) => {
      expect(isAllowedAvatarUrl(url)).toBe(true)
    })
  })

  // ── Rejected: scheme enforcement ─────────────────────────────────────────────

  describe("rejects non-HTTPS schemes", () => {
    it("rejects http (plain text transport)", () => {
      expect(isAllowedAvatarUrl("http://gravatar.com/avatar/abc")).toBe(false)
    })

    it("rejects ftp scheme", () => {
      expect(isAllowedAvatarUrl("ftp://gravatar.com/avatar/abc")).toBe(false)
    })

    it("rejects data URI (embedded binary content)", () => {
      expect(isAllowedAvatarUrl("data:image/png;base64,abc123==")).toBe(false)
    })

    it("rejects javascript scheme (XSS vector)", () => {
      expect(isAllowedAvatarUrl("javascript:alert(document.cookie)")).toBe(false)
    })

    it("rejects protocol-relative URL (no scheme)", () => {
      expect(isAllowedAvatarUrl("//gravatar.com/avatar/abc")).toBe(false)
    })
  })

  // ── Rejected: SSRF — blocklist takes priority over allowlist ─────────────────

  describe("blocks loopback and well-known SSRF targets", () => {
    it("blocks localhost — even though it appears in appAllowedHosts() via test mock", () => {
      expect(isAllowedAvatarUrl("https://localhost/internal-api")).toBe(false)
    })

    it("blocks 127.0.0.1", () => {
      expect(isAllowedAvatarUrl("https://127.0.0.1/secret")).toBe(false)
    })

    it("blocks 0.0.0.0", () => {
      expect(isAllowedAvatarUrl("https://0.0.0.0/")).toBe(false)
    })

    it("blocks IPv6 loopback [::1]", () => {
      // URL parser strips brackets; url.hostname === "::1"
      expect(isAllowedAvatarUrl("https://[::1]/internal")).toBe(false)
    })

    it("blocks AWS EC2 instance metadata endpoint", () => {
      expect(isAllowedAvatarUrl(
        "https://169.254.169.254/latest/meta-data/iam/security-credentials/"
      )).toBe(false)
    })

    it("blocks GCP instance metadata endpoint", () => {
      expect(isAllowedAvatarUrl(
        "https://metadata.google.internal/computeMetadata/v1/project/project-id"
      )).toBe(false)
    })
  })

  // ── Rejected: SSRF — raw IP addresses ────────────────────────────────────────

  describe("blocks raw IPv4 addresses regardless of range", () => {
    it.each([
      ["RFC-1918 class A",  "https://10.0.0.1/admin"],
      ["RFC-1918 class B",  "https://172.16.0.1/internal"],
      ["RFC-1918 class C",  "https://192.168.1.1/router"],
      ["public IP (test)",  "https://203.0.113.55/image.png"],
    ])("blocks %s: %s", (_, url) => {
      expect(isAllowedAvatarUrl(url)).toBe(false)
    })
  })

  describe("blocks raw IPv6 addresses", () => {
    it("blocks a valid public IPv6 address", () => {
      // URL parser returns hostname as the bare address (no brackets)
      expect(isAllowedAvatarUrl("https://[2001:db8::1]/img.png")).toBe(false)
    })
  })

  // ── Rejected: subdomain and look-alike bypass attempts ───────────────────────

  describe("rejects subdomains and look-alikes of trusted domains", () => {
    it("rejects subdomain of gravatar.com (evil.gravatar.com)", () => {
      expect(isAllowedAvatarUrl("https://evil.gravatar.com/avatar")).toBe(false)
    })

    it("rejects domain that ends with an allowed domain as TLD (gravatar.com.attacker.net)", () => {
      expect(isAllowedAvatarUrl("https://gravatar.com.attacker.net/img.png")).toBe(false)
    })

    it("rejects URL where allowed hostname appears only in the path", () => {
      expect(isAllowedAvatarUrl("https://attacker.net/gravatar.com/avatar")).toBe(false)
    })

    it("rejects URL where allowed hostname appears only in the query string", () => {
      expect(isAllowedAvatarUrl("https://attacker.net/?proxy=gravatar.com")).toBe(false)
    })

    it("rejects URL where allowed hostname appears in user-info (@ bypass)", () => {
      // https://user@host/path — URL.hostname resolves to 'attacker.net'
      expect(isAllowedAvatarUrl("https://gravatar.com@attacker.net/img.png")).toBe(false)
    })

    it("rejects URL with allowed hostname in username field", () => {
      expect(isAllowedAvatarUrl("https://gravatar.com:password@attacker.net/img")).toBe(false)
    })
  })

  // ── Rejected: arbitrary external domains ─────────────────────────────────────

  describe("rejects domains not in the allowlist", () => {
    it("rejects an unknown external domain", () => {
      expect(isAllowedAvatarUrl("https://attacker.example.com/evil.png")).toBe(false)
    })

    it("rejects a domain that looks legitimate but is not listed", () => {
      expect(isAllowedAvatarUrl("https://fakegravatar.com/avatar/abc")).toBe(false)
    })

    it("rejects a domain with gravatar as a subdomain of a malicious host", () => {
      expect(isAllowedAvatarUrl("https://gravatar.attacker.com/img")).toBe(false)
    })
  })

  // ── Rejected: malformed inputs ───────────────────────────────────────────────

  describe("handles malformed and edge-case inputs", () => {
    it("rejects empty string", () => {
      expect(isAllowedAvatarUrl("")).toBe(false)
    })

    it("rejects plain text (not a URL)", () => {
      expect(isAllowedAvatarUrl("just some text")).toBe(false)
    })

    it("rejects relative path", () => {
      expect(isAllowedAvatarUrl("/avatar/abc.png")).toBe(false)
    })

    it("rejects URL with no host", () => {
      expect(isAllowedAvatarUrl("https:///no-host/img.png")).toBe(false)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Elysia }    from "elysia"
import { Effect }    from "effect"
import { MOCK_USER } from "../fixtures"
import { UpdateProfileBody } from "@/schemas"

vi.mock("@/repository/user.repository", () => ({
  userRepository: {
    update: vi.fn(),
  },
}))

import { userRepository }         from "@/repository/user.repository"
import { updateProfileHandler }   from "@/handlers/update-profile"

const USER_ID_HEADER = { "x-user-id": MOCK_USER.id }

const app = new Elysia()
  .patch("/profile", updateProfileHandler, { body: UpdateProfileBody })

function patch(body: unknown, headers: Record<string, string> = USER_ID_HEADER) {
  return app.handle(new Request("http://localhost/profile", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body:    JSON.stringify(body),
  }))
}

const UPDATED_USER = {
  ...MOCK_USER,
  name:      "Updated Name",
  phone:     "+628123456789",
  avatarUrl: "https://gravatar.com/avatar/abc123",
}

describe("updateProfileHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userRepository.update).mockReturnValue(Effect.succeed(UPDATED_USER as any))
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when x-user-id header is missing", async () => {
    const res = await patch({ name: "Alice" }, {})
    expect(res.status).toBe(401)
  })

  // ── At-least-one-field guard ──────────────────────────────────────────────

  it("returns 400 when no updatable fields are provided", async () => {
    const res = await patch({})
    expect(res.status).toBe(400)
  })

  // ── Successful updates ────────────────────────────────────────────────────

  it("returns 200 with updated user on valid name change", async () => {
    const res  = await patch({ name: "Alice" })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.name).toBe(UPDATED_USER.name)
  })

  it("returns 200 when avatarUrl is from an allowed domain (gravatar.com)", async () => {
    const res = await patch({ avatarUrl: "https://gravatar.com/avatar/abc123" })
    expect(res.status).toBe(200)
  })

  it("returns 200 when avatarUrl is from ui-avatars.com", async () => {
    const res = await patch({ avatarUrl: "https://ui-avatars.com/api/?name=Alice" })
    expect(res.status).toBe(200)
  })

  it("returns 200 when avatarUrl is from api.dicebear.com", async () => {
    const res = await patch({ avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" })
    expect(res.status).toBe(200)
  })

  it("returns 200 when avatarUrl is from res.cloudinary.com", async () => {
    const res = await patch({ avatarUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg" })
    expect(res.status).toBe(200)
  })

  it("returns 200 when avatarUrl is from avatars.githubusercontent.com", async () => {
    const res = await patch({ avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4" })
    expect(res.status).toBe(200)
  })

  // ── avatarUrl domain allowlist ────────────────────────────────────────────

  it("returns 400 when avatarUrl points to an arbitrary external domain", async () => {
    const res  = await patch({ avatarUrl: "https://attacker.example.com/evil.png" })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/avatarUrl must be an HTTPS URL from an allowed domain/i)
  })

  it("returns 400 when avatarUrl uses http (non-HTTPS)", async () => {
    const res = await patch({ avatarUrl: "http://gravatar.com/avatar/abc" })
    expect(res.status).toBe(400)
  })

  it("returns 400 when avatarUrl uses data: scheme", async () => {
    const res = await patch({ avatarUrl: "data:image/png;base64,abc123" })
    expect(res.status).toBe(400)
  })

  it("returns 400 when avatarUrl targets an internal IP (SSRF attempt)", async () => {
    const res = await patch({ avatarUrl: "https://169.254.169.254/latest/meta-data/" })
    expect(res.status).toBe(400)
  })

  it("returns 400 when avatarUrl targets localhost (SSRF attempt)", async () => {
    const res = await patch({ avatarUrl: "https://localhost/internal-api" })
    expect(res.status).toBe(400)
  })

  it("returns 400 when avatarUrl targets an RFC-1918 address (SSRF attempt)", async () => {
    const res = await patch({ avatarUrl: "https://192.168.1.1/admin" })
    expect(res.status).toBe(400)
  })

  // ── Repository failures ───────────────────────────────────────────────────

  it("returns 404 when userRepository.update returns null", async () => {
    vi.mocked(userRepository.update).mockReturnValue(Effect.succeed(null as any))
    const res = await patch({ name: "Ghost" })
    expect(res.status).toBe(404)
  })
})

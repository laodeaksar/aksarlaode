import { describe, it, expect } from "vitest"
import { Hono }                from "hono"
import { meHandler }           from "@/handlers/me"

const app = new Hono()
app.get("/me", meHandler)

describe("meHandler", () => {
  it("returns 200 with user id and role from headers", async () => {
    const res  = await app.request("/me", {
      headers: { "x-user-id": "user-1", "x-user-role": "ADMIN" },
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.id).toBe("user-1")
    expect(body.data.role).toBe("ADMIN")
  })

  it("defaults role to CUSTOMER when x-user-role is absent", async () => {
    const res  = await app.request("/me", {
      headers: { "x-user-id": "user-1" },
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.role).toBe("CUSTOMER")
  })

  it("returns 401 when x-user-id header is missing", async () => {
    const res = await app.request("/me")
    expect(res.status).toBe(401)
  })
})

import { describe, it, expect } from "vitest"
import { Elysia }               from "elysia"
import { meHandler }            from "@/handlers/me"

const app = new Elysia().get("/me", meHandler)

describe("meHandler", () => {
  it("returns 200 with user id and role from headers", async () => {
    const res  = await app.handle(new Request("http://localhost/me", {
      headers: { "x-user-id": "user-1", "x-user-role": "ADMIN" },
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.id).toBe("user-1")
    expect(body.data.role).toBe("ADMIN")
  })

  it("defaults role to CUSTOMER when x-user-role is absent", async () => {
    const res  = await app.handle(new Request("http://localhost/me", {
      headers: { "x-user-id": "user-1" },
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.role).toBe("CUSTOMER")
  })

  it("returns 401 when x-user-id header is missing", async () => {
    const res = await app.handle(new Request("http://localhost/me"))
    expect(res.status).toBe(401)
  })
})

/**
 * End-to-end smoke test: register → login → refresh → logout
 *
 * Exercises the full Elysia middleware pipeline (service-token guard,
 * per-email rate limiter, security headers) and the real Postgres database
 * (Drizzle ORM, transactions).  Redis is replaced by the in-memory mock
 * in __mocks__/redis.ts; password hashing uses the SHA-256 shim because
 * Argon2 native bindings are not available under the Node Vitest runner.
 *
 * Run via:
 *   pnpm --filter auth-service test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Elysia }  from "elysia"
import { cors }    from "@elysiajs/cors"
import { Pool }    from "pg"

import authRoutes    from "@/routes/auth.routes"
import sessionRoutes from "@/routes/session.routes"
import adminRoutes   from "@/routes/admin.routes"
import { serviceTokenMiddleware } from "@/middleware/service-token"
import { env }                    from "@repo/env/auth"

// ── App factory (mirrors index.ts, without .listen()) ──────────────────────
function makeApp() {
  return new Elysia()
    .use(cors({
      origin:         [env.WEB_URL, env.ADMIN_URL],
      allowedHeaders: ["Content-Type", "Authorization", "x-service-token",
                       "x-user-id", "x-session-id", "x-request-id"],
      credentials:    true,
    }))
    .onBeforeHandle(serviceTokenMiddleware)
    .use(authRoutes)
    .use(sessionRoutes)
    .use(adminRoutes)
    .onError(({ code, error, set }) => {
      if (code === "VALIDATION") { set.status = 422; return { error: "Validation failed" } }
      if (code === "NOT_FOUND")  { set.status = 404; return { error: "Not found" } }
      set.status = 500
      console.error("[smoke] unhandled:", error.message)
      return { error: "Internal server error" }
    })
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SERVICE_TOKEN = env.INTERNAL_SERVICE_TOKEN

async function request(
  app:     Elysia,
  method:  string,
  path:    string,
  opts:    { body?: unknown; cookie?: string; userId?: string; sessionId?: string } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type":   "application/json",
    "x-service-token": SERVICE_TOKEN,
  }
  if (opts.cookie)    headers["Cookie"]       = opts.cookie
  if (opts.userId)    headers["x-user-id"]    = opts.userId
  if (opts.sessionId) headers["x-session-id"] = opts.sessionId

  const res = await app.handle(new Request(`http://localhost${path}`, {
    method,
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  }))

  // Debug: log body on server errors so failures are visible in CI
  if (res.status >= 500) {
    const cloned = res.clone()
    const body   = await cloned.json().catch(() => "(non-json body)")
    console.error(`[smoke] ${method} ${path} → ${res.status}:`, JSON.stringify(body))
  }

  return res
}

function extractRefreshCookie(res: Response): string | null {
  const raw = res.headers.get("set-cookie") ?? ""
  const m   = raw.match(/ec_refresh=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// ── Unique test-run email ──────────────────────────────────────────────────

const runId     = crypto.randomUUID().slice(0, 8)
const testEmail = `smoke+${runId}@integration.test`
const testPass  = "SmokeTest1!"
const testName  = "Smoke User"

// ── State shared across steps ──────────────────────────────────────────────

let app: Elysia
let userId: string
let refreshToken: string

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeAll(() => {
  app = makeApp()
})

afterAll(async () => {
  // Hard-delete the test user so re-runs start clean.
  // Uses a short-lived pg.Pool (the db singleton is owned by Drizzle).
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  try {
    await pool.query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [testEmail])
    await pool.query(`DELETE FROM users WHERE email = $1`, [testEmail])
  } finally {
    await pool.end()
  }
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe("auth smoke — register", () => {
  it("returns 201 with accessToken and user shape", async () => {
    const res  = await request(app, "POST", "/auth/register", {
      body: { email: testEmail, name: testName, password: testPass },
    })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.accessToken).toBeTypeOf("string")
    expect(body.user.email).toBe(testEmail)
    expect(body.user).not.toHaveProperty("passwordHash")

    // Persist for subsequent steps
    userId       = body.user.id
    refreshToken = extractRefreshCookie(res) ?? ""
    expect(refreshToken).not.toBe("")
  })

  it("sets ec_refresh cookie with correct attributes", async () => {
    // Use a fresh unique email so this independent assertion doesn't conflict
    const uniqueEmail = `smoke+attr+${crypto.randomUUID().slice(0, 8)}@integration.test`
    const res = await request(app, "POST", "/auth/register", {
      body: { email: uniqueEmail, name: "Attr Test", password: testPass },
    })
    const cookie = res.headers.get("set-cookie") ?? ""

    expect(cookie).toContain("ec_refresh=")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("Path=/auth")

    // Clean up the extra user
    const pool = new Pool({ connectionString: env.DATABASE_URL })
    await pool.query(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [uniqueEmail])
    await pool.query(`DELETE FROM users WHERE email = $1`, [uniqueEmail])
    await pool.end()
  })

  it("returns 409 when the same email registers again", async () => {
    const res  = await request(app, "POST", "/auth/register", {
      body: { email: testEmail, name: "Dup", password: testPass },
    })
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.field).toBe("email")
  })

  it("returns 422 for a missing required field", async () => {
    const res = await request(app, "POST", "/auth/register", {
      body: { email: testEmail, password: testPass },   // name missing
    })
    expect(res.status).toBe(422)
  })
})

describe("auth smoke — login", () => {
  it("returns 200 with a fresh accessToken for valid credentials", async () => {
    const res  = await request(app, "POST", "/auth/login", {
      body: { email: testEmail, password: testPass },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.accessToken).toBeTypeOf("string")
    expect(body.user.email).toBe(testEmail)
    expect(body.user).not.toHaveProperty("passwordHash")

    // Rotate the refreshToken to the one issued by login (session was rotated)
    const loginCookie = extractRefreshCookie(res)
    if (loginCookie) refreshToken = loginCookie
  })

  it("returns 401 for the wrong password", async () => {
    const res = await request(app, "POST", "/auth/login", {
      body: { email: testEmail, password: "WrongPassword!" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 for a non-existent email", async () => {
    const res = await request(app, "POST", "/auth/login", {
      body: { email: `ghost+${runId}@integration.test`, password: testPass },
    })
    expect(res.status).toBe(401)
  })
})

describe("auth smoke — refresh", () => {
  it("returns 200 with a new accessToken using the refresh cookie", async () => {
    const res  = await request(app, "POST", "/auth/refresh", {
      cookie: `ec_refresh=${refreshToken}`,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.accessToken).toBeTypeOf("string")

    // Rotate token for the logout step
    const rotated = extractRefreshCookie(res)
    if (rotated) refreshToken = rotated
  })

  it("returns 401 when no refresh cookie is present", async () => {
    const res = await request(app, "POST", "/auth/refresh")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a fabricated / invalid token", async () => {
    const res = await request(app, "POST", "/auth/refresh", {
      cookie: "ec_refresh=not-a-real-token",
    })
    expect(res.status).toBe(401)
  })
})

describe("auth smoke — logout", () => {
  it("returns 200 and clears the refresh cookie", async () => {
    const res  = await request(app, "POST", "/auth/logout", {
      cookie:  `ec_refresh=${refreshToken}`,
      userId,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toMatch(/logged out/i)

    const clearedCookie = res.headers.get("set-cookie") ?? ""
    expect(clearedCookie).toContain("ec_refresh=")
    expect(clearedCookie).toMatch(/Max-Age=0/)
  })

  it("using the consumed refresh token again returns 401 (session deleted from DB)", async () => {
    const res = await request(app, "POST", "/auth/refresh", {
      cookie: `ec_refresh=${refreshToken}`,
    })
    expect(res.status).toBe(401)
  })
})

describe("auth smoke — service-token guard", () => {
  it("returns 403 for any request missing the service token", async () => {
    const res = await app.handle(new Request("http://localhost/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: testEmail, password: testPass }),
    }))
    expect(res.status).toBe(403)
  })
})

# auth-service

Dedicated authentication microservice for the e-commerce platform. Runs on port **3001** and is the single source of truth for user identity, passwords, JWT tokens, and sessions.

All other services call this service via an internal API gateway that injects `x-service-token` + `x-user-id` headers — no service should handle passwords or token signing directly.

---

## Tech Stack

| | |
|---|---|
| Framework | [Hono](https://hono.dev) + `@hono/node-server` |
| Error handling | [Effect-TS](https://effect.website) |
| Auth library | [better-auth](https://better-auth.com) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) (PostgreSQL) |
| Crypto | WebCrypto API (native, zero dependencies) |

---

## Running

```bash
# development (watch mode)
pnpm --filter auth-service dev

# production
pnpm --filter auth-service build
pnpm --filter auth-service start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | HMAC-SHA256 key for JWT signing (≥ 32 chars) |
| `INTERNAL_SERVICE_TOKEN` | ✅ | Shared secret for inter-service calls |
| `WEB_URL` | ✅ | Trusted frontend origin |
| `ADMIN_URL` | ✅ | Trusted admin panel origin |
| `PORT` | — | Listen port (default: `3001`) |

---

## API Endpoints

### Public (no auth required)

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check → `{ status: "ok" }` |
| `POST` | `/auth/login` | 10 req / 15 min / IP | Login with email + password |
| `POST` | `/auth/register` | 5 req / 1 h / IP | Register new user |
| `POST` | `/auth/logout` | — | Clear refresh cookie + revoke session |
| `POST` | `/auth/forgot-password` | 5 req / 1 h / IP | Request password reset token |
| `POST` | `/auth/reset-password` | — | Reset password with token |
| `POST` | `/auth/refresh` | — | Rotate refresh token → new access token |

### Internal (requires `x-service-token` header)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/me` | Get user info from `x-user-id` header |
| `PATCH` | `/auth/me` | Update profile (name, phone, avatarUrl) |
| `POST` | `/auth/change-password` | Change password (requires current password) |
| `GET` | `/session` | List all active sessions for the user |
| `DELETE` | `/session/:id` | Revoke a specific session by ID |

---

## Request & Response Shapes

### `POST /auth/register`
```json
// Request
{ "email": "user@example.com", "name": "Budi", "password": "secret123" }

// Response 201
{
  "user": { "id": "...", "email": "...", "name": "..." },
  "accessToken": "<jwt>"
}
// Cookie: ec_refresh=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh
```

### `POST /auth/login`
```json
// Request
{ "email": "user@example.com", "password": "secret123" }

// Response 200
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "CUSTOMER" },
  "accessToken": "<jwt>"
}
```

### `POST /auth/refresh`
```json
// Cookie: ec_refresh=<jwt> (required)

// Response 200
{ "accessToken": "<new-jwt>" }
// Cookie: ec_refresh=<new-jwt>  (rotated)
```

### `POST /auth/forgot-password`
```json
// Request
{ "email": "user@example.com" }

// Response 200 (always, even if email not found)
{
  "message": "If that email is registered, a reset token has been issued.",
  "resetToken": "<hex-token-or-null>"
}
```

### `POST /auth/reset-password`
```json
// Request
{ "token": "<hex-token>", "newPassword": "newSecret123" }

// Response 200
{ "message": "Password reset successful. Please log in with your new password." }
```

### `POST /auth/change-password`
```json
// Headers: x-service-token, x-user-id

// Request
{ "currentPassword": "oldSecret", "newPassword": "newSecret123" }

// Response 200
{ "message": "Password changed. Please log in again." }
```

### `PATCH /auth/me`
```json
// Headers: x-service-token, x-user-id

// Request (all fields optional, at least one required)
{ "name": "Budi Santoso", "phone": "+628123456789", "avatarUrl": "https://..." }

// Response 200
{ "user": { "id": "...", "email": "...", "name": "...", "phone": "...", "avatarUrl": "...", "role": "..." } }
```

### `GET /session`
```json
// Headers: x-service-token, x-user-id

// Response 200
{
  "sessions": [
    { "id": "abc-123", "createdAt": "2026-05-13T08:00:00Z", "expiresAt": "2026-05-20T08:00:00Z" },
    { "id": "def-456", "createdAt": "2026-05-12T14:30:00Z", "expiresAt": "2026-05-19T14:30:00Z" }
  ]
}
```

### `DELETE /session/:id`
```json
// Headers: x-service-token, x-user-id

// Response 200
{ "message": "Session revoked" }
```

---

## Authentication Flow

```
REGISTER / LOGIN
────────────────
Client → POST /auth/register or /auth/login
       ← accessToken (body)  — expires in 15 min
       ← ec_refresh cookie   — HttpOnly, Secure, 7 days

AUTHENTICATED REQUEST (via API Gateway)
────────────────────────────────────────
Client → API Gateway (sends accessToken in Authorization header)
       → Gateway verifies JWT, injects x-user-id + x-user-role + x-service-token
       → Internal service (e.g. GET /auth/me)
       ← User data

TOKEN REFRESH
─────────────
Client → POST /auth/refresh  (cookie sent automatically)
       ← new accessToken (body)
       ← new ec_refresh cookie (old one revoked in DB)

LOGOUT
──────
Client → POST /auth/logout
       → DB: session deleted (token revoked server-side)
       ← ec_refresh cookie cleared (Max-Age=0)

FORGOT PASSWORD
───────────────
Client → POST /auth/forgot-password { email }
       → DB: old reset tokens deleted, new token stored (1h expiry)
       ← resetToken (passed to email service by API gateway)

Client → POST /auth/reset-password { token, newPassword }
       → DB: token verified + consumed, password updated, ALL sessions revoked
       ← 200 OK
```

---

## Database Schema

Managed by Drizzle ORM in `packages/database`. Run migrations from the monorepo root:

```bash
pnpm db:generate   # after any schema change
pnpm db:migrate    # apply to the database
```

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `email` | TEXT UNIQUE NOT NULL | |
| `name` | TEXT NOT NULL | |
| `password_hash` | TEXT NOT NULL | PBKDF2-SHA256, 100k iterations |
| `role` | ENUM | `CUSTOMER` \| `ADMIN` |
| `avatar_url` | TEXT | nullable |
| `phone` | TEXT | nullable |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID — also embedded in JWT as `sessionId` |
| `user_id` | TEXT FK → users | cascade delete |
| `token` | TEXT UNIQUE | raw refresh JWT |
| `expires_at` | TIMESTAMP | 7 days from login |
| `created_at` | TIMESTAMP | |

### `password_reset_tokens`
| Column | Type | Notes |
|---|---|---|
| `token` | TEXT PK | 32-byte random hex (64 chars) |
| `user_id` | TEXT FK → users | cascade delete |
| `expires_at` | TIMESTAMP | 1 hour from request |
| `created_at` | TIMESTAMP | |

---

## Security Design Decisions

| Decision | Rationale |
|---|---|
| PBKDF2 with 100,000 iterations | Sufficient work factor for password hashing using native WebCrypto — no bcrypt dependency needed |
| Constant-time comparison | Prevents timing attacks when verifying passwords |
| Same error for "user not found" and "wrong password" | Prevents user enumeration on login |
| Always return 200 on forgot-password | Prevents email enumeration |
| `Path=/auth/refresh` on cookie | Refresh token only sent to the one endpoint that needs it |
| `sessionId` stored in DB | Enables true server-side logout and session revocation |
| One reset token per user at a time | Prevents token accumulation and old-link confusion |
| Rate limiting on auth endpoints | Mitigates brute-force and automated abuse |
| `x-service-token` guard on internal routes | Ensures only the API gateway can call privileged endpoints |

---

## File Structure

```
src/
├── index.ts                         # Server entry point (port 3001)
├── types/index.ts                   # AppEnv, UserRole
├── lib/
│   ├── better-auth.ts               # Session management via better-auth
│   ├── password.ts                  # PBKDF2 hash + constant-time verify
│   └── token.ts                     # JWT sign + verify (WebCrypto HMAC-SHA256)
├── middleware/
│   ├── service-token.ts             # Internal service auth guard
│   └── rate-limit.ts                # IP-based in-memory rate limiter
├── repository/
│   ├── user.repository.ts           # users table CRUD
│   ├── session.repository.ts        # sessions table CRUD
│   └── reset-token.repository.ts    # password_reset_tokens table CRUD
├── handlers/
│   ├── login.ts
│   ├── register.ts
│   ├── logout.ts
│   ├── me.ts
│   ├── refresh.ts
│   ├── update-profile.ts
│   ├── change-password.ts
│   ├── forgot-password.ts
│   ├── reset-password.ts
│   ├── list-sessions.ts
│   └── revoke-session.ts
└── routes/
    ├── auth.routes.ts               # /auth/* routes
    └── session.routes.ts            # /session/* routes
```

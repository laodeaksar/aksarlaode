# my-ecommerce Monorepo

## Project Overview

Full-stack e-commerce platform built as a **pnpm monorepo** with Turborepo. The system follows a microservice architecture where each `apps/*` service owns a specific domain.

## Monorepo Structure

```
/
├── apps/
│   └── auth-service/       # Authentication & session management (port 3001)
├── packages/
│   ├── common/             # Shared Zod schemas and TypeScript types
│   ├── database/           # Drizzle ORM + PostgreSQL + MongoDB clients
│   └── typescript-config/  # Shared tsconfig presets
├── docker/                 # docker-compose for local infrastructure
├── turbo.json              # Turborepo pipeline config
└── pnpm-workspace.yaml
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Language | TypeScript 5.4 (strict) |
| Framework | Hono + @hono/node-server |
| FP / Error handling | Effect-TS (effect ^3.15) |
| ORM | Drizzle ORM (PostgreSQL) |
| Document DB | Mongoose (MongoDB) |
| Auth library | better-auth ^1.2 |
| Build & dev | Turborepo + tsx (dev), tsc (prod) |
| Package manager | pnpm 9 |

## Running the Project

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for local infra)

### Local Infrastructure

```bash
pnpm infra:up       # start PostgreSQL + MongoDB via docker-compose
pnpm infra:down     # stop containers
pnpm infra:reset    # wipe volumes and restart
```

### Database Migrations

```bash
pnpm db:generate    # generate migration files from schema changes
pnpm db:migrate     # apply pending migrations
pnpm db:studio      # open Drizzle Studio (visual DB browser)
```

### Development

```bash
pnpm dev            # run all services concurrently via Turborepo
```

Or run a specific service:

```bash
pnpm --filter auth-service dev
```

### Build & Production

```bash
pnpm build          # build all packages
pnpm --filter auth-service start   # start compiled service
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | database | PostgreSQL connection string |
| `MONGODB_URL` | database | MongoDB connection string |
| `JWT_SECRET` | auth-service | HMAC-SHA256 signing key (≥ 32 chars) |
| `INTERNAL_SERVICE_TOKEN` | auth-service | Shared secret for inter-service calls |
| `WEB_URL` | auth-service | Frontend origin (CORS trusted) |
| `ADMIN_URL` | auth-service | Admin panel origin (CORS trusted) |
| `PORT` | auth-service | Listen port (default: 3001) |

## User Preferences

- Use Effect-TS for all async/error handling — no raw try/catch in handlers
- Typed errors via `Data.TaggedError` — never use plain `Error` objects
- All DB access goes through repository files — no inline queries in handlers
- Shared schemas live in `@repo/common`, not in individual services
- Keep handlers thin — business logic in `lib/` or repositories

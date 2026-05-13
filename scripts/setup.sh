#!/usr/bin/env bash
set -e

echo "🚀 Setting up My Ecommerce monorepo..."

# 1. Check prerequisites
command -v node  >/dev/null || { echo "❌ Node.js 20+ required"; exit 1; }
command -v pnpm  >/dev/null || { echo "❌ pnpm required: npm i -g pnpm"; exit 1; }
command -v docker>/dev/null || { echo "❌ Docker required"; exit 1; }

# 2. Copy env file if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 .env created from .env.example — fill in secrets before continuing"
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# 4. Start infra
echo "🐳 Starting infrastructure..."
pnpm infra:up

# 5. Wait for postgres
echo "⏳ Waiting for PostgreSQL..."
until docker exec ec_postgres pg_isready -U ecuser; do sleep 1; done

# 6. Run migrations
echo "🗄️  Running database migrations..."
pnpm db:migrate

echo "✅ Setup complete!"
echo ""
echo "Start dev servers:  pnpm dev"
echo "Start dev tools:    docker compose -f docker/docker-compose.yml --profile tools up -d"
echo "View Redis UI:      http://localhost:8081"
echo "View Mongo UI:      http://localhost:8082"
echo "View email (SMTP):  http://localhost:8025"

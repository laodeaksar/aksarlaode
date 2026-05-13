-- ============================================================
-- 0000_initial_schema.sql
-- Full initial schema covering all tables.
-- Applied by: pnpm db:migrate
-- ============================================================

-- Enums
CREATE TYPE "public"."user_role"       AS ENUM('CUSTOMER', 'ADMIN');
--> statement-breakpoint
CREATE TYPE "public"."product_status"  AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');
--> statement-breakpoint
CREATE TYPE "public"."payment_status"  AS ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED');
--> statement-breakpoint

-- categories (no external FKs, referenced by products)
CREATE TABLE IF NOT EXISTS "categories" (
  "id"          TEXT        PRIMARY KEY,
  "name"        TEXT        NOT NULL,
  "slug"        TEXT        NOT NULL UNIQUE,
  "description" TEXT,
  "image_url"   TEXT,
  "parent_id"   TEXT        REFERENCES "categories"("id") ON DELETE SET NULL,
  "sort_order"  INTEGER     DEFAULT 0,
  "created_at"  TIMESTAMP   DEFAULT NOW() NOT NULL,
  "updated_at"  TIMESTAMP   DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- users
CREATE TABLE IF NOT EXISTS "users" (
  "id"            TEXT        PRIMARY KEY,
  "email"         TEXT        NOT NULL UNIQUE,
  "name"          TEXT        NOT NULL,
  "password_hash" TEXT        NOT NULL,
  "role"          "user_role" DEFAULT 'CUSTOMER' NOT NULL,
  "avatar_url"    TEXT,
  "phone"         TEXT,
  "created_at"    TIMESTAMP   DEFAULT NOW() NOT NULL,
  "updated_at"    TIMESTAMP   DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- sessions
CREATE TABLE IF NOT EXISTS "sessions" (
  "id"         TEXT      PRIMARY KEY,
  "user_id"    TEXT      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token"      TEXT      NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "token"      TEXT      PRIMARY KEY,
  "user_id"    TEXT      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- products
CREATE TABLE IF NOT EXISTS "products" (
  "id"           TEXT             PRIMARY KEY,
  "name"         TEXT             NOT NULL,
  "slug"         TEXT             NOT NULL UNIQUE,
  "sku"          TEXT             NOT NULL UNIQUE,
  "description"  TEXT,
  "category_id"  TEXT             REFERENCES "categories"("id") ON DELETE SET NULL,
  "price"        INTEGER          NOT NULL,
  "compare_price" INTEGER,
  "stock"        INTEGER          NOT NULL DEFAULT 0,
  "weight"       INTEGER,
  "image_urls"   JSONB            DEFAULT '[]',
  "tags"         JSONB            DEFAULT '[]',
  "status"       "product_status" DEFAULT 'DRAFT' NOT NULL,
  "is_digital"   BOOLEAN          DEFAULT FALSE,
  "sales_count"  INTEGER          DEFAULT 0,
  "created_at"   TIMESTAMP        DEFAULT NOW() NOT NULL,
  "updated_at"   TIMESTAMP        DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- payments
CREATE TABLE IF NOT EXISTS "payments" (
  "id"           TEXT             PRIMARY KEY,
  "order_id"     TEXT             NOT NULL UNIQUE,
  "user_id"      TEXT             NOT NULL REFERENCES "users"("id"),
  "amount"       INTEGER          NOT NULL,
  "status"       "payment_status" DEFAULT 'PENDING' NOT NULL,
  "snap_token"   TEXT,
  "payment_type" TEXT,
  "paid_at"      TIMESTAMP,
  "created_at"   TIMESTAMP        DEFAULT NOW() NOT NULL,
  "updated_at"   TIMESTAMP        DEFAULT NOW() NOT NULL
);
--> statement-breakpoint

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id"              ON "sessions"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prt_user_id"                   ON "password_reset_tokens"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_category_id"          ON "products"("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_status"               ON "products"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_user_id"              ON "payments"("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_order_id"             ON "payments"("order_id");

-- ============================================================
-- 0001_add_owner_role_and_deleted_at.sql
-- Adds OWNER to user_role enum and deleted_at (soft-delete) to users.
-- ============================================================

ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'OWNER';
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

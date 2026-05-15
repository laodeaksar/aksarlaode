-- ============================================================
-- Migration 003: Add soft-delete support to users table
-- ============================================================
-- Adds a nullable deleted_at timestamp column.
-- NULL  → active user
-- non-NULL → soft-deleted; excluded from normal queries
--
-- Re-runnable (idempotent): the column is only added when it
-- does not already exist.
-- ============================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMIT;

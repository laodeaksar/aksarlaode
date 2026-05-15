-- ============================================================
-- Migration 002: Add OWNER to user_role enum
-- ============================================================
-- PostgreSQL allows adding enum values without a full type
-- rebuild. IF NOT EXISTS makes this re-runnable (idempotent).
--
-- Deploy order:
--   1. Run this migration on every DB replica BEFORE deploying
--      application code that references the OWNER role.
--   2. No downtime required — existing rows are unaffected.
-- ============================================================

BEGIN;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'OWNER';

-- Verify the new value is present (will error and roll back if not)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN  pg_type  t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
    AND   e.enumlabel = 'OWNER'
  ) THEN
    RAISE EXCEPTION 'Migration failed: OWNER not found in user_role enum';
  END IF;
END
$$;

COMMIT;

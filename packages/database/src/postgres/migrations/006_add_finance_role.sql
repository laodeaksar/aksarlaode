-- ============================================================
-- Migration 006: Add FINANCE to user_role enum
-- ============================================================
-- FIX ADM-05: Introduces a FINANCE role with read-only access
-- to orders and revenue data, no access to product management.
--
-- Deploy order:
--   1. Run this migration BEFORE deploying application code
--      that references the FINANCE role.
--   2. No downtime required — existing rows are unaffected.
-- ============================================================

BEGIN;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FINANCE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN  pg_type  t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
    AND   e.enumlabel = 'FINANCE'
  ) THEN
    RAISE EXCEPTION 'Migration failed: FINANCE not found in user_role enum';
  END IF;
END
$$;

COMMIT;

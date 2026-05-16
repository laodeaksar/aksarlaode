-- ============================================================
-- Migration 005: Soft-delete support for products table
-- ============================================================
-- FIX PRD-04: Adds a nullable deleted_at timestamp column.
-- NULL     → active product (normal behaviour)
-- non-NULL → soft-deleted; excluded from all public queries
--
-- Hard-deleting a product would orphan order line items that
-- reference it by ID.  Soft-delete preserves history while
-- making the product invisible to catalog and search queries.
--
-- Re-runnable (idempotent).
-- ============================================================

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at
  ON products(deleted_at)
  WHERE deleted_at IS NULL;

COMMIT;

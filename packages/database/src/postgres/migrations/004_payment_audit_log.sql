-- ============================================================
-- Migration 004: Payment audit log (immutable append-only)
-- ============================================================
-- FIX PAY-08: Creates a forensic audit trail for every payment
-- status transition. The table has NO UPDATE and NO DELETE
-- semantics by design — only INSERTs are ever issued.
-- This makes it suitable for financial reconciliation and
-- fraud investigation.
--
-- Re-runnable (idempotent): TABLE is created only if absent.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS payment_audit_log (
  id           TEXT        PRIMARY KEY,
  payment_id   TEXT        NOT NULL,
  order_id     TEXT        NOT NULL,
  user_id      TEXT        NOT NULL,
  event        TEXT        NOT NULL,          -- e.g. "payment_initiated", "payment_status_changed"
  old_status   TEXT,
  new_status   TEXT        NOT NULL,
  amount       INTEGER     NOT NULL,
  payment_type TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for forensic lookups by order or payment
CREATE INDEX IF NOT EXISTS idx_payment_audit_order_id   ON payment_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_payment_id ON payment_audit_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_created_at ON payment_audit_log(created_at);

COMMIT;

-- ============================================================
-- 0002_add_payment_user_email.sql
-- FIX PAY-07: store userEmail on payment record at initiation
-- time so webhook handler never needs a round-trip to auth-service.
-- Column is nullable for backwards compatibility with existing records.
-- ============================================================

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "user_email" TEXT;

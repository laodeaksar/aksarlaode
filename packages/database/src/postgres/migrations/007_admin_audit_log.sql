-- FIX ADM-06b: Immutable audit log for sensitive admin actions.
-- Only INSERTs are ever issued — no UPDATE or DELETE.
-- Captures product deletes, order status changes, and role changes
-- for forensic investigation and compliance purposes.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           TEXT        PRIMARY KEY,
  actor_id     TEXT        NOT NULL,             -- admin user who performed the action
  actor_role   TEXT        NOT NULL,             -- ADMIN | OWNER | FINANCE
  action       TEXT        NOT NULL,             -- "product_deleted" | "order_status_changed" | "user_role_changed"
  resource     TEXT        NOT NULL,             -- "product" | "order" | "user"
  resource_id  TEXT        NOT NULL,             -- ID of the affected entity
  old_value    JSONB,                            -- snapshot before the change (nullable)
  new_value    JSONB,                            -- snapshot after the change (nullable)
  metadata     JSONB,                            -- extra context (request_id, ip, etc.)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by actor and by resource
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id    ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource_id ON admin_audit_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at  ON admin_audit_log(created_at DESC);

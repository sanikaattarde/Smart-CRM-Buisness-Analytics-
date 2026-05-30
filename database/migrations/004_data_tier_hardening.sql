/*
 * Migration 003: Data tier hardening (tenant isolation, FK correctness, indexing, vacuum, concurrency)
 *
 * NOTE:
 * - This script is ordered intentionally and is designed for PostgreSQL 15.
 * - Statements use IF EXISTS / IF NOT EXISTS where possible for idempotency.
 * - CREATE INDEX CONCURRENTLY statements must run outside explicit transactions.
 */

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Composite unique indexes required for org-safe composite FKs
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_users_org_id_id ON users(org_id, id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_customers_org_id_id ON customers(org_id, id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_pipeline_stages_org_id_id ON pipeline_stages(org_id, id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_leads_org_id_id ON leads(org_id, id);

-- 3) Add org-safe foreign keys (NOT VALID first for lower lock impact)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_org_fk;
ALTER TABLE leads ADD CONSTRAINT leads_customer_org_fk
  FOREIGN KEY (org_id, customer_id) REFERENCES customers(org_id, id) ON DELETE SET NULL NOT VALID;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_to_org_fk;
ALTER TABLE leads ADD CONSTRAINT leads_assigned_to_org_fk
  FOREIGN KEY (org_id, assigned_to) REFERENCES users(org_id, id) ON DELETE SET NULL NOT VALID;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_org_fk;
ALTER TABLE leads ADD CONSTRAINT leads_stage_org_fk
  FOREIGN KEY (org_id, pipeline_stage_id) REFERENCES pipeline_stages(org_id, id) ON DELETE SET NULL NOT VALID;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_org_fk;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_org_fk
  FOREIGN KEY (org_id, assigned_to) REFERENCES users(org_id, id) ON DELETE SET NULL NOT VALID;

ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_customer_org_fk;
ALTER TABLE interactions ADD CONSTRAINT interactions_customer_org_fk
  FOREIGN KEY (org_id, customer_id) REFERENCES customers(org_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_user_org_fk;
ALTER TABLE interactions ADD CONSTRAINT interactions_user_org_fk
  FOREIGN KEY (org_id, user_id) REFERENCES users(org_id, id) ON DELETE SET NULL NOT VALID;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_lead_org_fk;
ALTER TABLE deals ADD CONSTRAINT deals_lead_org_fk
  FOREIGN KEY (org_id, lead_id) REFERENCES leads(org_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_org_fk;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_org_fk
  FOREIGN KEY (org_id, user_id) REFERENCES users(org_id, id) ON DELETE SET NULL NOT VALID;

-- 4) Validate new FKs and remove old weak FKs
ALTER TABLE leads VALIDATE CONSTRAINT leads_customer_org_fk;
ALTER TABLE leads VALIDATE CONSTRAINT leads_assigned_to_org_fk;
ALTER TABLE leads VALIDATE CONSTRAINT leads_stage_org_fk;
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_assigned_to_org_fk;
ALTER TABLE interactions VALIDATE CONSTRAINT interactions_customer_org_fk;
ALTER TABLE interactions VALIDATE CONSTRAINT interactions_user_org_fk;
ALTER TABLE deals VALIDATE CONSTRAINT deals_lead_org_fk;
ALTER TABLE activity_logs VALIDATE CONSTRAINT activity_logs_user_org_fk;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pipeline_stage_id_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_customer_id_fkey;
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_user_id_fkey;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_lead_id_fkey;
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;

-- 5) Enforce RLS tenant boundary at DB layer
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid
$$;

ALTER ROLE smartcrm NOBYPASSRLS;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','customers','pipeline_stages','leads','tasks',
    'interactions','deals','activity_logs','analytics_snapshots'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON %I USING (org_id = app.current_org_id()) WITH CHECK (org_id = app.current_org_id())',
      t, t
    );
  END LOOP;
END
$$;

-- 6) High-impact read indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_org_created_at_desc
  ON leads(org_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_open_org_stage
  ON leads(org_id, pipeline_stage_id)
  WHERE status = 'open';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_org_status_priority_due
  ON tasks(org_id, status, priority, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin (email gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_company_trgm
  ON customers USING gin (company gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_metadata_gin
  ON activity_logs USING gin (metadata jsonb_path_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_created_brin
  ON activity_logs USING brin (created_at) WITH (pages_per_range = 128);

-- 7) Churn-table bloat / vacuum tuning
ALTER TABLE leads SET (
  fillfactor = 80,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 1000
);

ALTER TABLE tasks SET (
  fillfactor = 80,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 1000
);

ALTER TABLE activity_logs SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 5000,
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_analyze_threshold = 5000
);

-- 8) Optimistic locking primitive for leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_org_id_id_version ON leads(org_id, id, version);

/*
 * Migration 002: Performance hardening indexes
 * Adds composite indexes used by analytics, kanban, and activity feeds.
 */

CREATE INDEX IF NOT EXISTS idx_leads_org_stage_status
  ON leads(org_id, pipeline_stage_id, status);

CREATE INDEX IF NOT EXISTS idx_deals_org_status_close_date
  ON deals(org_id, status, close_date);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created_at
  ON activity_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_org_created_at
  ON customers(org_id, created_at DESC);

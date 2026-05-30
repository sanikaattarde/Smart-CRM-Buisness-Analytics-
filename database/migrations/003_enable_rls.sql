-- migration: 003_enable_rls.sql

-- Helper: set the org context on every connection
CREATE OR REPLACE FUNCTION set_tenant_context(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', p_org_id::TEXT, true);
END;
$$ LANGUAGE plpgsql;

-- Enable RLS and Force it (since the app connects as table owner)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions FORCE ROW LEVEL SECURITY;

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals FORCE ROW LEVEL SECURITY;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots FORCE ROW LEVEL SECURITY;

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages FORCE ROW LEVEL SECURITY;

-- Create policies (using missing_ok=true so queries without context return 0 rows instead of throwing error)
CREATE POLICY tenant_isolation_users ON users
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_customers ON customers
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_leads ON leads
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_tasks ON tasks
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_interactions ON interactions
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_deals ON deals
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_activity_logs ON activity_logs
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_analytics_snapshots ON analytics_snapshots
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY tenant_isolation_pipeline_stages ON pipeline_stages
  USING (org_id = current_setting('app.current_org_id', true)::UUID)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::UUID);

/*
 * UUID vs Auto-Increment Justification:
 * We use UUIDs (gen_random_uuid()) instead of sequential integers for primary keys to:
 * 1. Prevent enumeration attacks (e.g., guessing /api/v1/customers/5).
 * 2. Allow offline/distributed generation of IDs before database insertion.
 * 3. Simplify merging data across databases or environments without ID conflicts.
 */

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  settings JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_customers INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  health_score INTEGER,
  tags TEXT[],
  segment VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL,
  color VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  pipeline_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  score INTEGER DEFAULT 0,
  source VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  related_to_type VARCHAR(50),
  related_to_id UUID,
  title VARCHAR(255) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  value NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  close_date DATE,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(100),
  metadata JSONB,
  type VARCHAR(50) DEFAULT 'action',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, snapshot_date)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Every list endpoint filters by org_id first; this index eliminates full
-- table scans on users for all org-scoped queries.
CREATE INDEX idx_users_org_id ON users(org_id);

-- Supports all org-scoped customer list, search, and count queries.
CREATE INDEX idx_customers_org_id ON customers(org_id);

-- Supports all org-scoped lead list and funnel queries.
CREATE INDEX idx_leads_org_id ON leads(org_id);

-- Kanban board renders columns by fetching leads per pipeline stage; this
-- makes the GROUP BY / WHERE pipeline_stage_id lookup instant.
CREATE INDEX idx_leads_pipeline_stage ON leads(pipeline_stage_id);

-- Allows fast filtering of leads assigned to a specific user
-- (e.g., a sales rep viewing only their pipeline).
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);

-- Task list pages filter heavily by assignee; without this index the query
-- degrades to a sequential scan as task volume grows.
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- Due-date range queries (e.g., "tasks due this week") require an ordered
-- scan on due_date; a B-tree index satisfies both equality and range lookups.
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Customer timeline page fetches all interactions for a single customer;
-- this index makes that lookup O(log n) instead of O(n).
CREATE INDEX idx_interactions_customer_id ON interactions(customer_id);

-- Deal aggregations (total revenue per lead, won/lost breakdown) JOIN on
-- lead_id; this index prevents nested-loop sequential scans.
CREATE INDEX idx_deals_lead_id ON deals(lead_id);

-- Analytics dashboard queries the most recent snapshot per org ordered by
-- date DESC; the composite index with descending date matches that sort order
-- exactly, avoiding a sort step.
CREATE INDEX idx_analytics_snapshots_org_date ON analytics_snapshots(org_id, snapshot_date DESC);

-- Activity log queries filter by org then narrow to a specific entity type
-- and entity id (e.g., all events on lead X); the composite index covers the
-- full WHERE clause without a recheck filter.
CREATE INDEX idx_activity_logs_org_entity ON activity_logs(org_id, entity_type, entity_id);

-- Composite index for Kanban/lead funnel lookups by tenant + stage + status.
CREATE INDEX idx_leads_org_stage_status ON leads(org_id, pipeline_stage_id, status);

-- Composite index for revenue trends scoped by tenant + deal status + close_date.
CREATE INDEX idx_deals_org_status_close_date ON deals(org_id, status, close_date);

-- Speeds up activity-feed pagination by tenant and newest-first ordering.
CREATE INDEX idx_activity_logs_org_created_at ON activity_logs(org_id, created_at DESC);

-- Supports tenant-scoped customer timeline/list sorting by creation date.
CREATE INDEX idx_customers_org_created_at ON customers(org_id, created_at DESC);

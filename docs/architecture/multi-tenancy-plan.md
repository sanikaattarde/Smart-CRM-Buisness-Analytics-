# SmartCRM — Multi-Tenancy Architecture Plan (v2.0 Preview)

> Version 1.0 · Phase 1 Deliverable · Last Updated 2026-05-28  
> **Status:** Design Only — Not Implemented

---

## Tenancy Model: Row-Level Isolation

SmartCRM uses **row-level tenancy** with `organization_id` as the tenant discriminator on every data table. All tenant data resides in a single PostgreSQL database, single schema, shared tables.

```
┌───────────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Single Database)                   │
│                                                                   │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐       │
│  │  Org Alpha  │  Org Beta   │  Org Gamma  │  Org Delta  │       │
│  │  org_id=A   │  org_id=B   │  org_id=C   │  org_id=D   │       │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤       │
│  │  users      │  users      │  users      │  users      │       │
│  │  customers  │  customers  │  customers  │  customers  │       │
│  │  leads      │  leads      │  leads      │  leads      │       │
│  │  deals      │  deals      │  deals      │  deals      │       │
│  │  tasks      │  tasks      │  tasks      │  tasks      │       │
│  │  ...        │  ...        │  ...        │  ...        │       │
│  └─────────────┴─────────────┴─────────────┴─────────────┘       │
│                                                                   │
│  Same tables, same schema. Isolation enforced by:                 │
│  1. Application middleware (org_id injection)                     │
│  2. PostgreSQL Row-Level Security (RLS) policies                  │
│  3. Index-backed WHERE org_id = $1 on every query                 │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Why Row-Level Over Schema-Per-Tenant or Database-Per-Tenant

| Strategy | Isolation | Complexity | Scale Limit | Cost | SmartCRM Fit |
|----------|-----------|-----------|-------------|------|-------------|
| **Row-level** (chosen) | Logical (application + RLS) | Low | 10,000+ tenants | Lowest | ✅ Target: 10–200 employee orgs. Single-digit to low-hundreds of tenants in the near term. |
| Schema-per-tenant | Schema | Medium | ~500 schemas before migration overhead becomes prohibitive | Medium | ❌ Unnecessary isolation overhead for the target market. Schema migrations must run N times. |
| Database-per-tenant | Full | High | Limited by connection pool and infrastructure cost | Highest | ❌ Overkill. Each tenant requires its own connection pool. Operational burden scales linearly. |

---

## Organizations Table: The Multi-Tenant Root

```sql
-- The root entity for all tenant-scoped data.
-- Every other table references organizations(id) via org_id FK.

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  plan_tier     VARCHAR(50)  NOT NULL DEFAULT 'free',
  settings      JSONB        NOT NULL DEFAULT '{}',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  max_users     INTEGER      NOT NULL DEFAULT 5,
  max_customers INTEGER      NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- plan_tier values: 'free' | 'starter' | 'professional' | 'enterprise'
-- settings JSONB structure:
-- {
--   "timezone": "America/New_York",
--   "currency": "USD",
--   "fiscal_year_start": 1,
--   "features": {
--     "ai_insights": false,
--     "advanced_reports": false,
--     "api_access": false
--   },
--   "branding": {
--     "logo_url": null,
--     "primary_color": "#5b6af0"
--   }
-- }
```

### Organization-to-Table Relationship Map

Every data table carries `org_id` as a non-nullable foreign key with `ON DELETE CASCADE`:

```
organizations (root)
  ├── users              (org_id FK, CASCADE)
  ├── customers          (org_id FK, CASCADE)
  ├── leads              (org_id FK, CASCADE)
  ├── pipeline_stages    (org_id FK, CASCADE)
  ├── tasks              (org_id FK, CASCADE)
  ├── interactions       (org_id FK, CASCADE)
  ├── deals              (org_id FK, CASCADE)
  ├── activity_logs      (org_id FK, CASCADE)
  └── analytics_snapshots (org_id FK, CASCADE)
```

**Cascade semantics:** Deleting an organization removes all associated data across all tables. This is the nuclear option — used only for full account deletion with explicit confirmation.

---

## Isolation Enforcement: Three-Layer Defense

### Layer 1 — Application Middleware (Primary)

Every authenticated request passes through `tenantContext` middleware that extracts `organization_id` from the JWT claims and injects it into the request context.

```javascript
// backend/src/middleware/tenantContext.middleware.js (design — not implemented)

const tenantContext = (req, res, next) => {
  // req.user is set by auth.middleware (JWT verification)
  const orgId = req.user.organization_id;

  if (!orgId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_REQUIRED',
        message: 'No organization context found in token'
      }
    });
  }

  // Inject org_id into request context for downstream use
  req.orgId = orgId;
  next();
};
```

**Every repository method** receives `orgId` as its first parameter and includes `WHERE org_id = $1` in every query:

```javascript
// Pattern for all repository methods (design — not implemented)

const findAll = async (orgId, filters, pagination) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, health_score, created_at
     FROM customers
     WHERE org_id = $1
       AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [orgId, filters.search, pagination.limit, pagination.offset]
  );
  return rows;
};
```

### Layer 2 — PostgreSQL Row-Level Security (Defense-in-Depth)

RLS policies provide database-level enforcement as a safety net. Even if application code contains a bug that omits the `org_id` filter, RLS prevents cross-tenant data access.

```sql
-- Enable RLS on all tenant-scoped tables (design — not implemented)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policy: restrict all operations to the current tenant
-- The application sets current_setting('app.current_org_id') per connection

CREATE POLICY tenant_isolation_policy ON customers
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Repeat for all tables above
```

**Connection-level tenant context** is set at the start of each database transaction:

```javascript
// Pattern for setting RLS context (design — not implemented)

const withTenantContext = async (orgId, queryFn) => {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.current_org_id = $1", [orgId]);
    const result = await queryFn(client);
    return result;
  } finally {
    client.release();
  }
};
```

### Layer 3 — Index-Backed Query Performance

Every table has a B-tree index on `org_id` (or a composite index with `org_id` as the leading column) to ensure tenant-scoped queries use index scans, not sequential scans:

```sql
-- Already defined in Phase 2 schema. Repeated here for completeness.

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_customers_org_id ON customers(org_id);
CREATE INDEX idx_leads_org_id ON leads(org_id);
CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_deals_org_id ON deals(org_id);
-- ... all tenant-scoped tables
```

For tables with high query volume, composite indexes with `org_id` as the first column:

```sql
CREATE INDEX idx_leads_org_stage ON leads(org_id, pipeline_stage_id);
CREATE INDEX idx_tasks_org_assigned ON tasks(org_id, assigned_to);
CREATE INDEX idx_analytics_org_date ON analytics_snapshots(org_id, snapshot_date DESC);
```

---

## RBAC and Tenant Isolation Interplay

RBAC operates **within** a tenant boundary. The role hierarchy applies only to the user's own organization.

```
┌─────────────────────────────────────────────────────────────┐
│  Tenant Boundary (org_id = "org-alpha-uuid")                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  RBAC Layer                                           │  │
│  │                                                       │  │
│  │  super_admin ── full control over all org resources    │  │
│  │       │                                               │  │
│  │  business_admin ── CRUD all entities, manage settings │  │
│  │       │                                               │  │
│  │  manager ── CRUD entities, view team analytics        │  │
│  │       │                                               │  │
│  │  employee ── limited CRUD, own resources only         │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  A super_admin in Org Alpha has ZERO visibility into        │
│  Org Beta's data. Tenant isolation is enforced before       │
│  RBAC evaluation.                                           │
└─────────────────────────────────────────────────────────────┘
```

### Middleware Execution Order

```
Request
  │
  ├─► 1. auth.middleware        → Verify JWT, extract userId + orgId
  │
  ├─► 2. tenantContext.middleware → Set req.orgId, validate org exists + is_active
  │
  ├─► 3. rbac.middleware         → Check user's role against required permission
  │                                (operates within tenant boundary)
  │
  └─► 4. Controller / Service   → All queries scoped to req.orgId
```

### Cross-Tenant Access Prevention

| Attack Vector | Mitigation |
|--------------|------------|
| User modifies `org_id` in request body | `org_id` is **never** accepted from request body. Always sourced from JWT claims. |
| User forges JWT with different `org_id` | JWT signed with `JWT_SECRET`. Signature verification in auth middleware prevents tampering. |
| SQL injection to bypass `org_id` filter | All queries use parameterised statements (`$1`, `$2`). No string interpolation. |
| Application bug omits `org_id` WHERE clause | RLS policy at the database level provides defense-in-depth. Query returns empty results instead of cross-tenant data. |
| Direct database access | Database credentials restricted to the application user. No public network exposure. |

---

## Subscription Tier Enforcement (v2.0)

The `organizations.plan_tier` column drives feature gating and resource limits:

```javascript
// Tier enforcement middleware (design — not implemented)

const TIER_LIMITS = {
  free:          { max_users: 3,   max_customers: 50,   features: [] },
  starter:       { max_users: 10,  max_customers: 500,  features: ['advanced_filters'] },
  professional:  { max_users: 50,  max_customers: 5000, features: ['advanced_filters', 'ai_insights', 'api_access'] },
  enterprise:    { max_users: -1,  max_customers: -1,   features: ['advanced_filters', 'ai_insights', 'api_access', 'sso', 'audit_log'] }
};

const requireTier = (...requiredFeatures) => async (req, res, next) => {
  const org = await getOrganization(req.orgId);
  const tierConfig = TIER_LIMITS[org.plan_tier];

  for (const feature of requiredFeatures) {
    if (!tierConfig.features.includes(feature)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TIER_UPGRADE_REQUIRED',
          message: `Feature "${feature}" requires ${getMinimumTier(feature)} plan`,
          current_tier: org.plan_tier,
          upgrade_url: '/settings/billing'
        }
      });
    }
  }

  next();
};

// Usage in routes:
// router.get('/insights', requireTier('ai_insights'), insightsController.list);
```

### Resource Limit Enforcement

```javascript
// Checked before creating new users or customers (design — not implemented)

const enforceResourceLimit = (resourceType) => async (req, res, next) => {
  const org = await getOrganization(req.orgId);
  const tierConfig = TIER_LIMITS[org.plan_tier];
  const limit = tierConfig[`max_${resourceType}`];

  if (limit === -1) return next(); // Unlimited

  const currentCount = await getResourceCount(req.orgId, resourceType);

  if (currentCount >= limit) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'RESOURCE_LIMIT_REACHED',
        message: `${org.plan_tier} plan allows ${limit} ${resourceType}. Current: ${currentCount}.`,
        current_tier: org.plan_tier,
        limit: limit,
        current: currentCount,
        upgrade_url: '/settings/billing'
      }
    });
  }

  next();
};
```

---

## Data Isolation Verification Strategy

### Automated Testing (v2.0 Implementation Phase)

```javascript
// Test: Tenant A cannot access Tenant B's data (design — not implemented)

describe('Multi-Tenancy Isolation', () => {
  it('should return empty results when querying with wrong org_id', async () => {
    // Setup: Create customer in Org A
    const customerInOrgA = await createCustomer(orgA.id, { name: 'Test' });

    // Act: Query with Org B's context
    const result = await customerRepository.findAll(orgB.id, {}, { limit: 100, offset: 0 });

    // Assert: Org B sees zero customers from Org A
    expect(result).toHaveLength(0);
  });

  it('should reject update attempts on cross-tenant resources', async () => {
    const customerInOrgA = await createCustomer(orgA.id, { name: 'Test' });

    // Act: Attempt to update Org A's customer using Org B's context
    const result = await customerRepository.update(orgB.id, customerInOrgA.id, { name: 'Hacked' });

    // Assert: Update affects zero rows
    expect(result.rowCount).toBe(0);
  });
});
```

### Query Audit (Production)

```sql
-- Periodic audit query: find any records without org_id (should return 0 rows)

SELECT 'users' AS table_name, COUNT(*) AS orphaned
FROM users WHERE org_id IS NULL
UNION ALL
SELECT 'customers', COUNT(*)
FROM customers WHERE org_id IS NULL
UNION ALL
SELECT 'leads', COUNT(*)
FROM leads WHERE org_id IS NULL;
-- ... extend for all tables
```

---

## Migration Path: v1.0 → v2.0

| Phase | Action | Risk |
|-------|--------|------|
| v1.0 (current) | Single organization seeded in dev. `org_id` column present on all tables but only one value exists. Middleware does not enforce tenant context — all queries implicitly operate on the single org. | Low — single-tenant mode. |
| v1.5 (migration) | Implement `tenantContext.middleware`. Update all repository methods to accept `orgId` as first parameter. Add RLS policies in disabled mode (monitor-only). | Medium — requires touching all repository methods. |
| v2.0 (launch) | Enable RLS policies. Implement organization signup flow. Add tier enforcement middleware. Enable multi-org data seeding in tests. | High — full tenant isolation activated. Requires comprehensive integration testing. |

### Schema Migration for v2.0

```sql
-- No schema changes needed — org_id columns and FK constraints
-- are already present from v1.0 schema design (Phase 2).
-- The migration is purely at the application layer:
-- 1. Middleware addition
-- 2. Repository method refactoring
-- 3. RLS policy activation

-- The only new table/columns for v2.0:
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_customer_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
```

---

## Open Considerations for v2.0 Implementation

| Topic | Decision Needed |
|-------|-----------------|
| Cross-tenant analytics (platform admin) | Separate `platform_admin` role with bypass on RLS? Or a dedicated analytics database with aggregated, anonymised data? |
| Data export on org deletion | Provide a full JSON/CSV export before CASCADE delete? Retention period? |
| Tenant-specific customisation | How far does `settings JSONB` extend? Custom fields on entities? Custom pipeline stages are already per-org. |
| Rate limiting per tenant | Shared rate limits (current) vs. per-tenant rate limits based on plan tier? |
| Background job tenant context | BullMQ jobs must carry `orgId` in job data. Worker must set tenant context before processing. |

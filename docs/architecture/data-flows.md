# SmartCRM — Critical User Journey Data Flows

> Version 1.0 · Phase 1 Deliverable · Last Updated 2026-05-28

---

## Journey 1: User Logs In and Views the Dashboard

**Actor:** Sales Manager (role: `manager`)

### Sequence

```
 Browser (React)                Express API                  PostgreSQL           Redis
 ──────────────                 ───────────                  ──────────           ─────
       │                              │                           │                 │
  1.   │─── POST /api/v1/auth/login ─►│                           │                 │
       │    { email, password }       │                           │                 │
       │                              │                           │                 │
  2.   │                              │──── SELECT id, email, ───►│                 │
       │                              │     password_hash, role   │                 │
       │                              │     FROM users            │                 │
       │                              │     WHERE email = $1      │                 │
       │                              │     AND is_active = true  │                 │
       │                              │◄──── row ────────────────│                 │
       │                              │                           │                 │
  3.   │                              │── bcrypt.compare(pw, hash)│                 │
       │                              │                           │                 │
  4.   │                              │──── SET refresh:{userId} ────────────────►│
       │                              │     TTL 7d, hashed token  │                 │
       │                              │                           │                 │
  5.   │◄── 200 ─────────────────────│                           │                 │
       │    {                         │                           │                 │
       │      success: true,          │                           │                 │
       │      data: {                 │                           │                 │
       │        accessToken: "ey...", │                           │                 │
       │        refreshToken: "ey...",│                           │                 │
       │        user: {               │                           │                 │
       │          id, email, role,    │                           │                 │
       │          name                │                           │                 │
       │        }                     │                           │                 │
       │      }                       │                           │                 │
       │    }                         │                           │                 │
       │                              │                           │                 │
  6.   │ authStore.login(data)        │                           │                 │
       │ → stores tokens + user       │                           │                 │
       │ → React Router navigates     │                           │                 │
       │   to /dashboard              │                           │                 │
       │                              │                           │                 │
  7.   │─── GET /api/v1/analytics ───►│                           │                 │
       │    /dashboard                │                           │                 │
       │    Authorization: Bearer JWT │                           │                 │
       │                              │                           │                 │
  8.   │                              │── auth.middleware ────────│                 │
       │                              │   verify JWT signature    │                 │
       │                              │   extract userId, orgId   │                 │
       │                              │                           │                 │
  9.   │                              │── CHECK cache ───────────────────────────►│
       │                              │   key: analytics:{orgId}  │                 │
       │                              │   :dashboard              │                 │
       │                              │                           │       MISS      │
       │                              │◄─────────────────────────────────────────│
       │                              │                           │                 │
 10.   │                              │──── analytics.service ──►│                 │
       │                              │                           │                 │
       │                              │  Q1: SELECT SUM(value)    │                 │
       │                              │      FROM deals           │                 │
       │                              │      WHERE org_id = $1    │                 │
       │                              │      AND status = 'won'   │                 │
       │                              │      AND close_date >=    │                 │
       │                              │        date_trunc('month',│                 │
       │                              │        NOW())             │                 │
       │                              │                           │                 │
       │                              │  Q2: SELECT ps.name,      │                 │
       │                              │      COUNT(l.id) AS count │                 │
       │                              │      FROM leads l          │                 │
       │                              │      JOIN pipeline_stages  │                 │
       │                              │        ps ON l.pipeline_   │                 │
       │                              │        stage_id = ps.id    │                 │
       │                              │      WHERE l.org_id = $1   │                 │
       │                              │      GROUP BY ps.name,     │                 │
       │                              │        ps.order_index      │                 │
       │                              │      ORDER BY ps.order_    │                 │
       │                              │        index               │                 │
       │                              │                           │                 │
       │                              │  Q3: Conversion rate from  │                 │
       │                              │      analytics_snapshots   │                 │
       │                              │      (last 12 weeks)       │                 │
       │                              │                           │                 │
       │                              │  Q4: AVG(health_score)     │                 │
       │                              │      FROM customers        │                 │
       │                              │      WHERE org_id = $1     │                 │
       │                              │                           │                 │
       │                              │◄──── result sets ────────│                 │
       │                              │                           │                 │
 11.   │                              │── SET cache ──────────────────────────────►│
       │                              │   key: analytics:{orgId}  │     TTL: 5min   │
       │                              │   :dashboard              │                 │
       │                              │                           │                 │
 12.   │◄── 200 ─────────────────────│                           │                 │
       │    {                         │                           │                 │
       │      success: true,          │                           │                 │
       │      data: {                 │                           │                 │
       │        totalRevenue: {       │                           │                 │
       │          current: 48500,     │                           │                 │
       │          previous: 42100,    │                           │                 │
       │          changePercent: 15.2 │                           │                 │
       │        },                    │                           │                 │
       │        activeLeads: {        │                           │                 │
       │          total: 47,          │                           │                 │
       │          byStage: [          │                           │                 │
       │            { name: "New",    │                           │                 │
       │              count: 12 },    │                           │                 │
       │            ...               │                           │                 │
       │          ]                   │                           │                 │
       │        },                    │                           │                 │
       │        conversionRate: {     │                           │                 │
       │          current: 0.23,      │                           │                 │
       │          trend: [...]        │                           │                 │
       │        },                    │                           │                 │
       │        avgHealthScore: 72.4  │                           │                 │
       │      },                      │                           │                 │
       │      meta: {                 │                           │                 │
       │        cached: false,        │                           │                 │
       │        computedAt: "..."     │                           │                 │
       │      }                       │                           │                 │
       │    }                         │                           │                 │
       │                              │                           │                 │
 13.   │ Dashboard renders:           │                           │                 │
       │ • KPI cards with skeleton    │                           │                 │
       │   → populated state          │                           │                 │
       │ • Recharts AreaChart (rev)   │                           │                 │
       │ • Recharts BarChart (leads)  │                           │                 │
       │ • Recharts LineChart (conv)  │                           │                 │
       │ • RadialBarChart (health)    │                           │                 │
```

### Error Paths

| Step | Failure Condition                  | Response                                                          |
|------|------------------------------------|-------------------------------------------------------------------|
| 2    | Email not found                    | `401 { success: false, error: { code: "INVALID_CREDENTIALS" } }`  |
| 3    | Password mismatch                  | `401 { success: false, error: { code: "INVALID_CREDENTIALS" } }`  |
| 8    | JWT expired                        | `401` → Axios interceptor calls `/auth/refresh` → retries request |
| 8    | JWT invalid signature              | `401` → `authStore.logout()` → redirect to `/login`              |
| 10   | PostgreSQL connection failure      | `503 { success: false, error: { code: "SERVICE_UNAVAILABLE" } }`  |

---

## Journey 2: Sales Rep Creates a Lead and Moves It Through Pipeline Stages

**Actor:** Sales Rep (role: `employee`)

### Sequence

```
 Browser (React)                Express API                  PostgreSQL           Redis
 ──────────────                 ───────────                  ──────────           ─────
       │                              │                           │                 │
  ── CREATE LEAD ──                   │                           │                 │
       │                              │                           │                 │
  1.   │ User fills lead form:        │                           │                 │
       │ customer, source, value      │                           │                 │
       │                              │                           │                 │
  2.   │─── POST /api/v1/leads ──────►│                           │                 │
       │    Authorization: Bearer JWT │                           │                 │
       │    {                         │                           │                 │
       │      customer_id: "uuid",    │                           │                 │
       │      source: "website",      │                           │                 │
       │      estimated_value: 15000  │                           │                 │
       │    }                         │                           │                 │
       │                              │                           │                 │
  3.   │                              │── auth.middleware ────────│                 │
       │                              │── rbac: requirePermission │                 │
       │                              │   ("leads", "create")     │                 │
       │                              │                           │                 │
  4.   │                              │── leads.validator ────────│                 │
       │                              │   • customer_id: valid UUID                 │
       │                              │   • source: enum check    │                 │
       │                              │   • estimated_value: > 0  │                 │
       │                              │                           │                 │
  5.   │                              │── leads.service.create() ─│                 │
       │                              │                           │                 │
       │                              │  5a. SELECT id FROM       │                 │
       │                              │      pipeline_stages     ►│                 │
       │                              │      WHERE org_id = $1    │                 │
       │                              │      ORDER BY order_index │                 │
       │                              │      LIMIT 1              │                 │
       │                              │  (get first stage ID)     │                 │
       │                              │◄─────────────────────────│                 │
       │                              │                           │                 │
       │                              │  5b. INSERT INTO leads    │                 │
       │                              │      (org_id, customer_id,│                 │
       │                              │       assigned_to,        │                 │
       │                              │       pipeline_stage_id,  │                 │
       │                              │       source, status,     │                 │
       │                              │       score)             ►│                 │
       │                              │      VALUES ($1,$2,$3,    │                 │
       │                              │       $4,$5,'open',0)     │                 │
       │                              │      RETURNING id,        │                 │
       │                              │       created_at          │                 │
       │                              │◄─────────────────────────│                 │
       │                              │                           │                 │
       │                              │  5c. INSERT INTO          │                 │
       │                              │      activity_logs       ►│                 │
       │                              │      (org_id, user_id,    │                 │
       │                              │       entity_type,        │                 │
       │                              │       entity_id, action,  │                 │
       │                              │       metadata)           │                 │
       │                              │◄─────────────────────────│                 │
       │                              │                           │                 │
  6.   │                              │── Invalidate cache ───────────────────────►│
       │                              │   DEL analytics:{orgId}:* │                 │
       │                              │                           │                 │
  7.   │◄── 201 ─────────────────────│                           │                 │
       │    {                         │                           │                 │
       │      success: true,          │                           │                 │
       │      data: {                 │                           │                 │
       │        id: "uuid",           │                           │                 │
       │        customer_id: "uuid",  │                           │                 │
       │        pipeline_stage_id:    │                           │                 │
       │          "uuid",             │                           │                 │
       │        stage_name: "New",    │                           │                 │
       │        source: "website",    │                           │                 │
       │        status: "open",       │                           │                 │
       │        score: 0,             │                           │                 │
       │        assigned_to: "uuid",  │                           │                 │
       │        created_at: "..."     │                           │                 │
       │      },                      │                           │                 │
       │      message: "Lead created" │                           │                 │
       │    }                         │                           │                 │
       │                              │                           │                 │
  8.   │ leadStore.leads.push(data)   │                           │                 │
       │ Kanban re-renders with new   │                           │                 │
       │ card in "New" column         │                           │                 │
       │                              │                           │                 │
  ── MOVE LEAD TO NEXT STAGE ──       │                           │                 │
       │                              │                           │                 │
  9.   │ User drags card from "New"   │                           │                 │
       │ to "Qualified" column        │                           │                 │
       │                              │                           │                 │
 10.   │ Optimistic UI update:        │                           │                 │
       │ leadStore moves card to      │                           │                 │
       │ target column immediately    │                           │                 │
       │                              │                           │                 │
 11.   │─── PATCH /api/v1/leads/ ────►│                           │                 │
       │    {leadId}/stage             │                           │                 │
       │    Authorization: Bearer JWT │                           │                 │
       │    {                         │                           │                 │
       │      pipeline_stage_id:      │                           │                 │
       │        "qualified-uuid"      │                           │                 │
       │    }                         │                           │                 │
       │                              │                           │                 │
 12.   │                              │── auth + rbac check ──────│                 │
       │                              │── ownership check:        │                 │
       │                              │   employee can only move  │                 │
       │                              │   own leads               │                 │
       │                              │                           │                 │
 13.   │                              │── leads.service           │                 │
       │                              │   .moveStage()           ►│                 │
       │                              │                           │                 │
       │                              │  13a. UPDATE leads        │                 │
       │                              │       SET pipeline_       │                 │
       │                              │       stage_id = $2,      │                 │
       │                              │       updated_at = NOW()  │                 │
       │                              │       WHERE id = $1       │                 │
       │                              │       AND org_id = $3     │                 │
       │                              │       RETURNING id,       │                 │
       │                              │       pipeline_stage_id   │                 │
       │                              │◄─────────────────────────│                 │
       │                              │                           │                 │
       │                              │  13b. INSERT INTO         │                 │
       │                              │       activity_logs      ►│                 │
       │                              │       action: 'lead_      │                 │
       │                              │       stage_moved'        │                 │
       │                              │       metadata: {         │                 │
       │                              │         from: "New",      │                 │
       │                              │         to: "Qualified"   │                 │
       │                              │       }                   │                 │
       │                              │◄─────────────────────────│                 │
       │                              │                           │                 │
 14.   │                              │── Invalidate cache ───────────────────────►│
       │                              │                           │                 │
 15.   │◄── 200 ─────────────────────│                           │                 │
       │    {                         │                           │                 │
       │      success: true,          │                           │                 │
       │      data: {                 │                           │                 │
       │        id: "uuid",           │                           │                 │
       │        pipeline_stage_id:    │                           │                 │
       │          "qualified-uuid",   │                           │                 │
       │        stage_name:           │                           │                 │
       │          "Qualified",        │                           │                 │
       │        updated_at: "..."     │                           │                 │
       │      },                      │                           │                 │
       │      message: "Lead moved    │                           │                 │
       │        to Qualified"         │                           │                 │
       │    }                         │                           │                 │
       │                              │                           │                 │
 16.   │ Optimistic update confirmed  │                           │                 │
       │ (no rollback needed)         │                           │                 │
```

### Error Paths

| Step | Failure Condition                  | Response                                                                     |
|------|------------------------------------|------------------------------------------------------------------------------|
| 3    | Token expired                      | `401` → Axios interceptor refreshes → retries                               |
| 3    | Employee tries to move another's lead | `403 { success: false, error: { code: "FORBIDDEN" } }`                    |
| 4    | Invalid `customer_id` format       | `422 { success: false, error: { code: "VALIDATION_ERROR", details: [...] } }`|
| 13a  | Lead not found or wrong org        | `404 { success: false, error: { code: "LEAD_NOT_FOUND" } }`                 |
| 13a  | Target stage doesn't exist         | `400 { success: false, error: { code: "INVALID_STAGE" } }`                  |
| 11   | Network failure after optimistic UI | Client rolls back: `leadStore` restores card to original column             |

### Optimistic Update Strategy

```
 User Action (Drag)
       │
       ├──► Immediate UI: move card to target column (leadStore mutation)
       │
       ├──► Fire PATCH request in background
       │
       ├──► On success (200): no-op (UI already correct)
       │
       └──► On error (4xx/5xx): rollback leadStore to previous state
                                 show error toast via uiStore.addNotification()
```

---

## Journey 3: Business Owner Views an AI-Generated Revenue Forecast

**Actor:** Business Owner (role: `business_admin`)

### Sequence

```
 Browser (React)          Express API              Redis              FastAPI ML           PostgreSQL
 ──────────────           ───────────              ─────              ──────────           ──────────
       │                        │                    │                     │                    │
  1.   │ Navigate to            │                    │                     │                    │
       │ /insights              │                    │                     │                    │
       │                        │                    │                     │                    │
  2.   │── GET /api/v1/ ───────►│                    │                     │                    │
       │   insights/revenue     │                    │                     │                    │
       │   ?period=Q3           │                    │                     │                    │
       │   Authorization:       │                    │                     │                    │
       │   Bearer JWT           │                    │                     │                    │
       │                        │                    │                     │                    │
  3.   │                        │── auth.middleware   │                     │                    │
       │                        │── rbac: require     │                     │                    │
       │                        │   Permission        │                     │                    │
       │                        │   ("analytics",     │                     │                    │
       │                        │    "read")           │                     │                    │
       │                        │                    │                     │                    │
  4.   │                        │── CHECK cache ────►│                     │                    │
       │                        │   key: ml:revenue  │                     │                    │
       │                        │   :{orgId}:Q3      │                     │                    │
       │                        │                    │                     │                    │
       │                        │◄── MISS ──────────│                     │                    │
       │                        │                    │                     │                    │
  5.   │                        │── Fetch historical ─────────────────────────────────────────►│
       │                        │   data for model   │                     │                    │
       │                        │                    │                     │                    │
       │                        │   SELECT            │                     │                    │
       │                        │     snapshot_date,  │                     │                    │
       │                        │     metrics->>      │                     │                    │
       │                        │     'total_revenue' │                     │                    │
       │                        │     AS revenue      │                     │                    │
       │                        │   FROM analytics_   │                     │                    │
       │                        │     snapshots       │                     │                    │
       │                        │   WHERE org_id = $1 │                     │                    │
       │                        │   ORDER BY          │                     │                    │
       │                        │     snapshot_date   │                     │                    │
       │                        │     DESC            │                     │                    │
       │                        │   LIMIT 90          │                     │                    │
       │                        │                    │                     │                    │
       │                        │◄───────────────────────────────────────────────────── rows ──│
       │                        │                    │                     │                    │
  6.   │                        │── mlServiceClient  │                     │                    │
       │                        │   .predictRevenue()│                     │                    │
       │                        │                    │                     │                    │
       │                        │── POST /predict/ ──────────────────────►│                    │
       │                        │   revenue          │                     │                    │
       │                        │   {                │                     │                    │
       │                        │     period: "Q3",  │                     │                    │
       │                        │     historical:    │                     │                    │
       │                        │       [...rows]    │                     │                    │
       │                        │   }                │                     │                    │
       │                        │   Timeout: 2000ms  │                     │                    │
       │                        │   Retries: 3       │                     │                    │
       │                        │                    │                     │                    │
  7.   │                        │                    │     ML pipeline:    │                    │
       │                        │                    │     │                │                    │
       │                        │                    │     ├─ Load revenue │                    │
       │                        │                    │     │  model (.pkl) │                    │
       │                        │                    │     │               │                    │
       │                        │                    │     ├─ Feature      │                    │
       │                        │                    │     │  engineering  │                    │
       │                        │                    │     │  (pandas)     │                    │
       │                        │                    │     │               │                    │
       │                        │                    │     ├─ model.       │                    │
       │                        │                    │     │  predict()    │                    │
       │                        │                    │     │               │                    │
       │                        │                    │     └─ Compute      │                    │
       │                        │                    │        confidence   │                    │
       │                        │                    │        interval     │                    │
       │                        │                    │                     │                    │
  8.   │                        │◄── 200 ───────────────────────────────│                    │
       │                        │   {                │                     │                    │
       │                        │     forecast:      │                     │                    │
       │                        │       142000,      │                     │                    │
       │                        │     range: [128000,│                     │                    │
       │                        │       156000],     │                     │                    │
       │                        │     confidence:    │                     │                    │
       │                        │       0.81,        │                     │                    │
       │                        │     model_version: │                     │                    │
       │                        │       "1.2.0"      │                     │                    │
       │                        │   }                │                     │                    │
       │                        │                    │                     │                    │
  9.   │                        │── SET cache ──────►│                     │                    │
       │                        │   key: ml:revenue  │                     │                    │
       │                        │   :{orgId}:Q3      │                     │                    │
       │                        │   TTL: 6 hours     │                     │                    │
       │                        │                    │                     │                    │
 10.   │◄── 200 ───────────────│                    │                     │                    │
       │    {                   │                    │                     │                    │
       │      success: true,    │                    │                     │                    │
       │      data: {           │                    │                     │                    │
       │        forecast: {     │                    │                     │                    │
       │          period: "Q3", │                    │                     │                    │
       │          predicted:    │                    │                     │                    │
       │            142000,     │                    │                     │                    │
       │          range: {      │                    │                     │                    │
       │            low: 128000,│                    │                     │                    │
       │            high:156000 │                    │                     │                    │
       │          },            │                    │                     │                    │
       │          confidence:   │                    │                     │                    │
       │            0.81        │                    │                     │                    │
       │        },              │                    │                     │                    │
       │        historicalTrend:│                    │                     │                    │
       │          [...90 days], │                    │                     │                    │
       │        modelVersion:   │                    │                     │                    │
       │          "1.2.0"       │                    │                     │                    │
       │      },                │                    │                     │                    │
       │      meta: {           │                    │                     │                    │
       │        cached: false,  │                    │                     │                    │
       │        generatedAt:    │                    │                     │                    │
       │          "..."         │                    │                     │                    │
       │      }                 │                    │                     │                    │
       │    }                   │                    │                     │                    │
       │                        │                    │                     │                    │
 11.   │ Insights page renders: │                    │                     │                    │
       │ • Revenue forecast     │                    │                     │                    │
       │   AreaChart with       │                    │                     │                    │
       │   confidence band      │                    │                     │                    │
       │ • Predicted value      │                    │                     │                    │
       │   highlighted          │                    │                     │                    │
       │ • Historical vs        │                    │                     │                    │
       │   projected overlay    │                    │                     │                    │
       │ • Model confidence     │                    │                     │                    │
       │   indicator            │                    │                     │                    │
```

### ML Service Fallback Path (Degraded Mode)

```
 Express API              Redis              FastAPI ML
 ───────────              ─────              ──────────
       │                    │                     │
       │── POST /predict/ ──────────────────────►│
       │   revenue          │                     │
       │                    │                     X  CONNECTION REFUSED
       │                    │                     │  (or timeout after 2s)
       │                    │                     │
       │── Retry 1 (1s) ───────────────────────►│
       │                    │                     X  TIMEOUT
       │                    │                     │
       │── Retry 2 (2s) ───────────────────────►│
       │                    │                     X  TIMEOUT
       │                    │                     │
       │── Retry 3 (4s) ───────────────────────►│
       │                    │                     X  TIMEOUT
       │                    │                     │
       │── FALLBACK:        │                     │
       │   GET cache ──────►│                     │
       │   key: ml:revenue  │                     │
       │   :{orgId}:Q3      │                     │
       │                    │                     │
       │◄── HIT ───────────│     (stale data,    │
       │   (cached from     │      max 6h old)    │
       │    last success)   │                     │
       │                    │                     │
       │── Return cached    │                     │
       │   prediction with  │                     │
       │   meta.cached=true │                     │
       │   meta.staleAt=... │                     │
```

### Error Paths

| Step | Failure Condition                  | Response                                                            |
|------|------------------------------------|---------------------------------------------------------------------|
| 3    | Role lacks analytics permission    | `403 { success: false, error: { code: "FORBIDDEN" } }`              |
| 6    | ML service unreachable (all retries) | Return cached prediction with `meta.cached: true, meta.stale: true` |
| 6    | ML service unreachable + no cache  | `503 { success: false, error: { code: "ML_SERVICE_UNAVAILABLE", message: "Forecast temporarily unavailable" } }` |
| 7    | Model not loaded (cold start)      | ML returns `503` → Express retries after delay                      |
| 5    | No historical data (new org)       | `200` with `forecast: null, message: "Insufficient data for forecast"` |

---

## Cross-Cutting Concerns

### JWT Refresh Flow (Applies to All Journeys)

```
 Axios Interceptor            Express API              Redis
 ─────────────────            ───────────              ─────
       │                            │                    │
       │── Original request ───────►│                    │
       │                            │                    │
       │◄── 401 Unauthorized ──────│                    │
       │    (accessToken expired)   │                    │
       │                            │                    │
       │── POST /api/v1/auth/ ─────►│                    │
       │   refresh                  │                    │
       │   { refreshToken }         │                    │
       │                            │── GET refresh: ───►│
       │                            │   {userId}         │
       │                            │◄── stored hash ───│
       │                            │                    │
       │                            │── Verify hash      │
       │                            │── Issue new        │
       │                            │   accessToken      │
       │                            │── Rotate refresh   │
       │                            │   token            │
       │                            │── SET refresh: ───►│
       │                            │   {userId} (new)   │
       │                            │                    │
       │◄── 200 { accessToken, ────│                    │
       │    refreshToken }          │                    │
       │                            │                    │
       │── authStore.setTokens()    │                    │
       │                            │                    │
       │── Retry original request ─►│                    │
       │   with new accessToken     │                    │
       │                            │                    │
       │◄── Original response ─────│                    │
```

### Activity Logging (Applies to All Write Operations)

Every mutation (POST, PATCH, PUT, DELETE) on CRM entities triggers an `activity_logs` INSERT:

```sql
INSERT INTO activity_logs (org_id, user_id, entity_type, entity_id, action, metadata)
VALUES ($1, $2, $3, $4, $5, $6);
```

| Field         | Source                                      |
|---------------|---------------------------------------------|
| `org_id`      | Extracted from authenticated JWT            |
| `user_id`     | Extracted from authenticated JWT            |
| `entity_type` | Route module name (`lead`, `customer`, etc) |
| `entity_id`   | Resource UUID from request params or body   |
| `action`      | Verb (`created`, `updated`, `deleted`, `stage_moved`) |
| `metadata`    | JSONB with before/after state diff          |

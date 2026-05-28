# SmartCRM — Implementation Plan
### Smart CRM & Business Analytics Platform · Engineering Prompt Series v2.0

---

> **How to use this document**
> This is a **phased engineering prompt series**, not a single monolithic request. Each phase produces one focused, production-quality deliverable. Run phases sequentially. Do not skip ahead. Use the **Master Context Block** (Section 1) in every phase prompt, then append only the Phase-Specific block for the current phase.

---

## Table of Contents

1. [Master Context Block](#1-master-context-block)
2. [Project Folder Structure](#2-project-folder-structure)
3. [Token Efficiency & Rate-Limit Optimisation](#3-token-efficiency--rate-limit-optimisation)
4. [Phase 1 — System Design & Architecture](#4-phase-1--system-design--architecture)
5. [Phase 2 — Database Schema](#5-phase-2--database-schema)
6. [Phase 3 — Backend API & Authentication](#6-phase-3--backend-api--authentication)
7. [Phase 4 — Frontend Architecture](#7-phase-4--frontend-architecture)
8. [Phase 5 — AI/ML Integration](#8-phase-5--aiml-integration)
9. [Phase 6 — Real-Time & Background Jobs](#9-phase-6--real-time--background-jobs)
10. [Phase 7 — DevOps & Deployment](#10-phase-7--devops--deployment)
11. [Phase 8 — Testing & QA](#11-phase-8--testing--qa)
12. [Quick Reference — Phase Prompt Template](#12-quick-reference--phase-prompt-template)

---

## 1. Master Context Block

> **Include verbatim at the start of every phase prompt.**

### Role

You are a **Senior Full-Stack Engineer and Software Architect** with 10+ years of experience building production SaaS products. You write code and design systems the way an experienced engineering team at a funded startup would — clean, deliberate, and deployable.

### Product

**SmartCRM** — An intelligent CRM and business analytics platform for growing businesses with 10–200 employees (sales teams, ops leads, business owners).

**Core value proposition:** One platform to manage customers, track sales pipelines, monitor team performance, and surface AI-powered business insights — without the complexity overhead of Salesforce or the feature gaps of spreadsheets.

### Target Users

- **Primary:** Sales Manager / Business Owner
- **Secondary:** Sales Rep, Operations Lead
- **Non-target:** Enterprise IT teams, developers, large organisations

### Committed Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + Tailwind CSS | Component reuse, fast iteration |
| State Management | Zustand | Lightweight, no Redux boilerplate |
| HTTP Client | Axios | Interceptor support for auth tokens |
| Backend | Node.js + Express.js | JS consistency, rich ecosystem |
| Database | PostgreSQL | Relational structure fits CRM entities; complex analytics queries |
| Cache / Queue | Redis + BullMQ | Session caching, background job processing |
| AI Service | Python + FastAPI | ML ecosystem (scikit-learn, pandas); isolated microservice |
| Visualisation | Recharts | React-native, composable, easier than Chart.js in JSX |
| Auth | JWT + Refresh Tokens | Stateless, scalable |
| Containerisation | Docker + Docker Compose | Local dev parity, consistent deployment |

> **No alternatives. No "or" options. These are the decided choices.**

### Feature Priority Tiers

**MVP (v1.0) — Build first, required for launch:**
- Authentication & RBAC
- Customer management (CRUD + search)
- Lead pipeline (Kanban board + stage tracking)
- Basic analytics dashboard (revenue, leads, conversion KPIs)
- Task assignment & tracking

**v1.1 — Post-launch, high-value additions:**
- AI insights module (churn risk, revenue forecast)
- Real-time notifications (Socket.IO)
- Email background jobs (BullMQ)
- Advanced filters, reports, exports

**v2.0 — Growth phase:**
- Multi-tenant workspace isolation
- NLP-based insight generation
- Subscription tier enforcement
- Anomaly detection

> Only build for the tier specified in each phase prompt.

### Architecture Overview

```
┌────────────────────────────────────────┐
│   React 18 + Tailwind + Zustand        │  ← Presentation Layer
└──────────────────┬─────────────────────┘
                   │  HTTPS / REST
┌──────────────────▼─────────────────────┐
│   Node.js + Express (API v1)           │  ← API Gateway + Business Logic
│   Auth Middleware + Rate Limiter       │
└────────┬─────────────────┬────────────┘
         │                 │
┌────────▼──────┐  ┌───────▼────────────┐
│  PostgreSQL   │  │  Redis Cache       │  ← Data Layer
│  (Primary)    │  │  + BullMQ Jobs     │
└───────────────┘  └────────┬───────────┘
                            │
              ┌─────────────▼──────────┐
              │  Python FastAPI        │  ← AI/ML Microservice
              │  (port 8001)          │
              │  Internal HTTP only   │
              └────────────────────────┘
```

### AI Service Integration Contract

The Python ML service is a **separate internal microservice**:
- Runs on `http://ml-service:8001` (internal Docker network only, never exposed publicly)
- Node.js backend calls it via HTTP using a dedicated `mlService.js` client
- Endpoints the ML service must expose:

```
POST /predict/churn       → { customer_id } → { churn_risk: 0.74, confidence: 0.81 }
POST /predict/revenue     → { period: "Q3" } → { forecast: 142000, range: [128000, 156000] }
POST /predict/lead-score  → { lead_id } → { score: 68, tier: "warm" }
GET  /insights/generate   → {} → { insights: [...] }
GET  /health              → { status: "ok", models_loaded: true }
```

- Models are pre-trained on **synthetic seed data** (generated during DB seeding)
- Retraining is triggered by a BullMQ job `retrain-models` — runs every 24 hours
- If the ML service is unreachable, Node.js returns cached last-known predictions (Redis TTL: 6 hours) — never a hard failure

### Engineering Standards (Non-Negotiable)

- No placeholder comments like `// TODO: implement this`
- No hardcoded credentials anywhere — use `.env` files
- All API responses follow a standard envelope:

```json
{ "success": true, "data": {}, "message": "", "meta": {} }
```

- Error responses:

```json
{ "success": false, "error": { "code": "LEAD_NOT_FOUND", "message": "..." } }
```

- PostgreSQL queries use parameterised statements — no raw string interpolation
- All routes are versioned under `/api/v1/`
- Folder structure follows a **feature-first modular layout** (see Section 2)

---

## 2. Project Folder Structure

> **Reference this in every phase.** All code must be placed in the exact path shown below.

```
smartcrm/
├── frontend/                          # React 18 application
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/                # Reusable UI components
│       │   ├── common/                # Button, Input, Modal, Badge, etc.
│       │   ├── layout/                # Sidebar, Navbar, PageWrapper
│       │   └── charts/                # Chart wrappers (Recharts)
│       ├── features/                  # Feature-first modules
│       │   ├── auth/
│       │   ├── customers/
│       │   ├── leads/
│       │   ├── tasks/
│       │   ├── dashboard/
│       │   └── insights/
│       ├── hooks/                     # Custom React hooks
│       ├── services/                  # Axios API service layer
│       ├── store/                     # Zustand stores
│       ├── routes/                    # Route definitions + guards
│       ├── utils/                     # Formatters, validators, helpers
│       └── App.jsx
│
├── backend/                           # Node.js + Express API
│   └── src/
│       ├── config/                    # DB, Redis, env config
│       ├── middleware/                # Auth, validation, error, rate-limit
│       ├── modules/                   # Feature modules (MVC per feature)
│       │   ├── auth/
│       │   │   ├── auth.controller.js
│       │   │   ├── auth.service.js
│       │   │   ├── auth.routes.js
│       │   │   └── auth.validator.js
│       │   ├── customers/
│       │   ├── leads/
│       │   ├── tasks/
│       │   ├── analytics/
│       │   └── insights/
│       ├── shared/                    # Shared utilities across modules
│       │   ├── response.helper.js
│       │   ├── logger.js
│       │   └── mlServiceClient.js
│       ├── jobs/                      # BullMQ job definitions
│       ├── sockets/                   # Socket.IO event handlers
│       ├── tests/
│       └── app.js
│
├── database/                          # All database artefacts
│   ├── migrations/                    # SQL migration files (numbered)
│   ├── seeds/                         # Seed scripts
│   └── schema.sql                     # Full schema reference
│
├── docs/                              # Project documentation
│   ├── api/                           # OpenAPI / Swagger YAML
│   ├── architecture/                  # Architecture diagrams
│   └── deployment.md
│
├── infra/                             # Infrastructure config
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
│       └── nginx.conf
│
├── ml-service/                        # Python FastAPI AI microservice
│   ├── app/
│   │   ├── api/                       # FastAPI route handlers
│   │   ├── models/                    # Trained model files (.pkl)
│   │   ├── pipelines/                 # Training + preprocessing pipelines
│   │   ├── services/                  # Prediction + insight logic
│   │   └── main.py
│   ├── data/                          # Synthetic training data
│   ├── notebooks/                     # EDA + model development
│   ├── requirements.txt
│   └── Dockerfile
│
├── .env.example
├── .gitignore
└── README.md
```

### Directory Responsibilities at a Glance

| Folder | Owner | What goes here |
|---|---|---|
| `frontend/` | Phase 4 | All React source, components, Zustand stores, Axios services |
| `backend/` | Phase 3 | Express routes, controllers, services, middleware, BullMQ jobs |
| `database/` | Phase 2 | SQL schema, numbered migrations, dev seed data |
| `docs/` | Phase 1 | Architecture docs, OpenAPI specs, deployment guides |
| `ml-service/` | Phase 5 | Python FastAPI app, trained `.pkl` models, training pipelines |
| `infra/` | Phase 7 | Docker Compose files, Nginx config |

---

## 3. Token Efficiency & Rate-Limit Optimisation

> **Critical for running this project under Anthropic API rate limits (antigravity constraints).**
> Follow every rule below to maximise output quality per token and avoid hitting TPM/RPM ceilings.

### 3.1 Prompt Construction Rules

**Always do this before submitting any phase prompt:**

1. **Strip the Master Context Block down to essentials for later phases.** Phases 5–8 do not need the full tech stack rationale table — include only the stack names.
2. **Never re-explain completed phases.** Reference them by name only: *"Auth is complete per Phase 3."*
3. **Use the Quick Reference Template** (Section 12) as the envelope — paste only the relevant section blocks inside it.
4. **One deliverable per request.** If a phase has 6 deliverables, split into sub-requests: Phase 3a (auth endpoints), Phase 3b (CRUD API), Phase 3c (rate limiting).
5. **Scope with surgical precision.** Instead of "build the backend," say "Write `backend/src/modules/leads/leads.service.js` — the service layer only. Controller and routes already exist."

### 3.2 Context Window Management

```
┌──────────────────────────────────────────────────────┐
│  PROMPT BUDGET (target: stay under 3,000 tokens)     │
│                                                       │
│  Master Context (trimmed)     ~600  tokens            │
│  Folder Structure (relevant)  ~200  tokens            │
│  Phase-Specific Block         ~800  tokens            │
│  Previously generated code    ~800  tokens (max)      │
│  Current task instruction     ~600  tokens            │
│                               ──────                  │
│  Total                        ~3,000 tokens           │
└──────────────────────────────────────────────────────┘
```

- **Only paste previously generated code** when the current task directly extends or modifies it.
- When referencing existing files, **paste only the relevant function signatures**, not full file contents.
- Use `// [existing code unchanged]` as a placeholder when showing partial file edits.

### 3.3 Output Optimisation Instructions

Add these lines verbatim to every phase prompt to control output verbosity:

```
OUTPUT RULES (follow strictly):
- Write production code only. No tutorial commentary.
- No inline explanations unless a decision is non-obvious.
- Omit boilerplate imports if identical to the previous response.
- If a file exceeds 120 lines, split into logical named sections with a comment header.
- Do not repeat the folder structure or tech stack in your response.
```

### 3.4 Rate-Limit Recovery Strategy

If you hit a rate limit (429 / TPM exceeded) mid-phase:

| Situation | Action |
|---|---|
| Hit RPM limit | Wait 60 seconds. Resume with the **exact same prompt** — do not resend context already acknowledged. |
| Hit TPM limit | Split the current deliverable in half. Complete Part A first, then Part B in a fresh request referencing "Part A is complete." |
| Context window overflow | Start a new conversation. Paste only: (1) trimmed Master Context, (2) list of completed phases, (3) the specific file you need next. |
| Repeated refusals on code scope | Reframe as: "Continue the implementation of `[filename]`. Previous context: [paste last 10 lines of prior output]." |

### 3.5 Batch-Friendly Phase Splitting

Recommended split for each heavy phase to stay within rate limits:

```
Phase 2 (Database) ──► 2a: Schema SQL   |  2b: Indexes + Seeds
Phase 3 (Backend)  ──► 3a: Auth system  |  3b: CRUD modules  |  3c: Rate limiting
Phase 4 (Frontend) ──► 4a: Store + Axios  |  4b: Layout + Routes  |  4c: Dashboard + Kanban
Phase 5 (ML)       ──► 5a: FastAPI app  |  5b: Model training  |  5c: mlServiceClient.js
Phase 7 (DevOps)   ──► 7a: Dockerfiles  |  7b: Compose files  |  7c: Nginx + CI
```

### 3.6 Minimal Viable Context Per Phase

Use this cheatsheet to trim the Master Context Block for each phase:

| Phase | Required Context Elements |
|---|---|
| Phase 1 (Design) | Full Master Context |
| Phase 2 (Database) | Stack (PostgreSQL only), Feature tiers, Engineering standards |
| Phase 3 (Backend) | Stack (Node/Express/Redis/JWT), API envelope, RBAC matrix, Standards |
| Phase 4 (Frontend) | Stack (React/Zustand/Axios/Recharts), UI spec, API base URL |
| Phase 5 (ML) | Stack (Python/FastAPI), AI Service Contract, Model requirements |
| Phase 6 (Jobs) | Stack (BullMQ/Redis/Socket.IO), Job table, Event table |
| Phase 7 (DevOps) | Stack (Docker), Service list, Deployment targets |
| Phase 8 (Testing) | Standards, Testing requirements, DB setup pattern |

---

## 4. Phase 1 — System Design & Architecture

**Output location:** `docs/architecture/`

**Tier:** Design documents only — no code in this phase.

### Objective

Produce the complete high-level design document that every subsequent phase will reference. This document locks in all architectural decisions before a single line of code is written.

### Step-by-Step Guide

**Step 1 — High-Level Architecture Diagram**
- Draw a text-based component diagram using ASCII box-and-arrow notation
- Must show all six layers: Frontend → Backend → PostgreSQL, Redis, ML Service, BullMQ
- Label every inter-service communication protocol (HTTPS/REST, internal HTTP, TCP)
- Save as `docs/architecture/hld.md`

**Step 2 — Critical User Journey Data Flows**
Document the exact data flow for these three journeys (request → service → DB → response):
1. User logs in and views the dashboard
2. Sales rep creates a lead and moves it through pipeline stages
3. Business owner views an AI-generated revenue forecast

For each journey, list: actor → frontend action → API endpoint → service method → DB query → response shape.

**Step 3 — Technical Decision Log**
Write a decision table with columns: Decision | Chosen | Rejected | Rationale. Cover:
- PostgreSQL over MongoDB
- Zustand over Redux
- FastAPI (Python) for ML service over Node.js ML
- JWT + Redis refresh tokens over session cookies
- BullMQ over raw Redis pub/sub

**Step 4 — API Versioning Strategy**
- Define the versioning scheme (`/api/v1/`, `/api/v2/`)
- Describe deprecation policy: minimum 2 version support window
- Specify how breaking changes are communicated (response headers, changelog)
- Save in `docs/api/versioning.md`

**Step 5 — Multi-Tenancy Architecture Plan (v2.0 Preview)**
- Describe the row-level tenancy approach using `organization_id` on every table
- Define the `organizations` table as the multi-tenant root
- Explain how RBAC enforces tenant isolation at the middleware layer
- Note: describe only — do not implement

### Deliverables Checklist

- [ ] `docs/architecture/hld.md` — text-based architecture diagram + layer descriptions
- [ ] `docs/architecture/data-flows.md` — 3 user journey flows with request/response shapes
- [ ] `docs/architecture/decisions.md` — technical decision log table
- [ ] `docs/api/versioning.md` — API versioning strategy
- [ ] `docs/architecture/multi-tenancy-plan.md` — v2.0 multi-tenancy design note

### Constraints

- No code in this phase — design documents only
- Use precise engineering language throughout
- Justify every major architectural decision with measurable rationale
- All diagrams must be ASCII/text-based (no image dependencies)

---

## 5. Phase 2 — Database Schema

**Output location:** `database/`

**Tier:** MVP (v1.0)

### Objective

Design and implement the complete PostgreSQL schema that underpins all CRM entities, analytics support tables, and multi-tenancy scaffolding. Every table decision here is load-bearing for all subsequent phases.

### Step-by-Step Guide

**Step 1 — Core Entity Tables**

Create the following tables in `database/schema.sql`. Each table must include `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ DEFAULT NOW()`, and `updated_at TIMESTAMPTZ DEFAULT NOW()`:

| Table | Key Columns | Notes |
|---|---|---|
| `organizations` | `name`, `slug`, `plan_tier`, `settings JSONB` | Multi-tenant root |
| `users` | `org_id`, `email`, `password_hash`, `role`, `is_active` | Role: `super_admin \| business_admin \| manager \| employee` |
| `customers` | `org_id`, `name`, `email`, `phone`, `company`, `health_score`, `tags TEXT[]`, `segment` | Full profile + segmentation |
| `leads` | `org_id`, `customer_id`, `assigned_to`, `pipeline_stage_id`, `score`, `source`, `status` | Pipeline entity |
| `pipeline_stages` | `org_id`, `name`, `order_index`, `color` | Configurable per organisation |
| `tasks` | `org_id`, `assigned_to`, `related_to_type`, `related_to_id`, `title`, `priority`, `status`, `due_date` | Polymorphic relation to customers/leads |
| `interactions` | `org_id`, `customer_id`, `user_id`, `type`, `notes`, `occurred_at` | Timeline touchpoints |
| `deals` | `org_id`, `lead_id`, `value NUMERIC(12,2)`, `currency`, `close_date`, `status` | Revenue tracking |

**Step 2 — Analytics Support Tables**

```sql
-- Append to schema.sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(100),
  metadata JSONB,
  type VARCHAR(50) DEFAULT 'action',   -- 'action' | 'job_failure' | 'system'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,             -- { total_revenue, active_leads, conversion_rate, ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, snapshot_date)
);
```

**Step 3 — Indexing Strategy**

Create indexes for every high-frequency query pattern. For each index, add a SQL comment explaining why it exists:

```sql
-- Fast org-scoped queries (every list endpoint filters by org_id)
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_customers_org_id ON customers(org_id);
CREATE INDEX idx_leads_org_id ON leads(org_id);
CREATE INDEX idx_leads_pipeline_stage ON leads(pipeline_stage_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_interactions_customer_id ON interactions(customer_id);
CREATE INDEX idx_deals_lead_id ON deals(lead_id);
CREATE INDEX idx_analytics_snapshots_org_date ON analytics_snapshots(org_id, snapshot_date DESC);
CREATE INDEX idx_activity_logs_org_entity ON activity_logs(org_id, entity_type, entity_id);
```

**Step 4 — Foreign Keys with ON DELETE Behaviour**

All foreign keys must explicitly declare ON DELETE behaviour. Use this matrix:

| Relationship | ON DELETE |
|---|---|
| `users.org_id → organizations.id` | CASCADE |
| `customers.org_id → organizations.id` | CASCADE |
| `leads.customer_id → customers.id` | SET NULL |
| `leads.assigned_to → users.id` | SET NULL |
| `leads.pipeline_stage_id → pipeline_stages.id` | SET NULL |
| `tasks.assigned_to → users.id` | SET NULL |
| `interactions.customer_id → customers.id` | CASCADE |
| `deals.lead_id → leads.id` | CASCADE |

**Step 5 — Seed Data Script**

Create `database/seeds/dev-seed.sql` with realistic fake data:
- 1 organisation (`SmartCRM Demo Org`)
- 5 users (1 per role)
- 20+ customers with varied health scores and tags
- 50+ leads spread across 5 pipeline stages
- 10+ deals in various states
- 30+ tasks assigned across users
- 50+ interaction records

### Deliverables Checklist

- [ ] `database/schema.sql` — full runnable PostgreSQL schema
- [ ] `database/seeds/dev-seed.sql` — realistic development seed data
- [ ] `database/migrations/001_initial_schema.sql` — initial migration file
- [ ] ER diagram description appended to `docs/architecture/er-diagram.md`

### Constraints

- All tables include `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`, `updated_at`
- All foreign keys explicitly defined with ON DELETE behaviour
- No `SELECT *` in example queries — always specify columns
- UUID over auto-increment: justify in a SQL comment at the top of `schema.sql`
- No raw string interpolation in any example queries — always parameterised

---

## 6. Phase 3 — Backend API & Authentication

**Output location:** `backend/src/`

**Tier:** MVP (v1.0)

### Objective

Implement the complete Express.js API including JWT authentication with refresh token rotation, RBAC middleware, full CRUD for all CRM entities, and production-grade middleware (rate limiting, validation, error handling). Every module follows `routes → controller → service → repository` strictly.

### Step-by-Step Guide

**Step 1 — Project Scaffold & Configuration**

```
backend/src/
├── config/
│   ├── db.js          # pg Pool setup, connection string from .env
│   ├── redis.js       # ioredis client
│   └── env.js         # Validated env vars (use joi or envalid)
├── app.js             # Express app factory (no listen here)
└── server.js          # Entry point: app.listen()
```

In `app.js`, register middleware in this order:
1. `helmet()` — security headers
2. `cors()` — configured for frontend origin only
3. `express.json({ limit: '10kb' })` — body parser with size cap
4. `morgan('combined')` — request logging
5. Rate limiter (Step 3)
6. Routes
7. 404 handler
8. Global error handler (last)

**Step 2 — Authentication System**

Implement all five auth endpoints in `backend/src/modules/auth/`:

```
POST /api/v1/auth/register   → hash password (bcrypt, rounds: 12), insert user, return tokens
POST /api/v1/auth/login      → verify password, issue accessToken (15min) + refreshToken (7d)
POST /api/v1/auth/refresh    → validate refreshToken from Redis, issue new accessToken
POST /api/v1/auth/logout     → delete refreshToken from Redis (key: refresh:{userId})
GET  /api/v1/auth/me         → return current user profile (requires valid accessToken)
```

Token storage:
- `accessToken`: JWT, TTL 15 minutes, signed with `JWT_SECRET`
- `refreshToken`: JWT, TTL 7 days, stored in Redis with key `refresh:{userId}`, hash before storing

**Step 3 — RBAC Middleware**

Create `backend/src/middleware/rbac.middleware.js`. Enforce this permission matrix:

| Resource | super_admin | business_admin | manager | employee |
|---|---|---|---|---|
| All users | CRUD | Read | Read | — |
| Customers | CRUD | CRUD | CRUD | Read + Create |
| Leads | CRUD | CRUD | CRUD | Own only |
| Analytics | Full | Full | Team | Personal |
| Settings | Full | Full | — | — |

Implement as: `requireRole(...roles)` and `requirePermission(resource, action)` middleware factories.

**Step 4 — CRUD Modules**

Implement full CRUD for these modules, each following `routes → controller → service → repository`:

- `backend/src/modules/customers/` — list (with search + pagination), get, create, update, delete
- `backend/src/modules/leads/` — list (filterable by stage/assigned), get, create, update, move stage, delete
- `backend/src/modules/pipeline_stages/` — list, create, update, reorder, delete
- `backend/src/modules/tasks/` — list (filterable by assignee/status/due), get, create, update, complete, delete
- `backend/src/modules/analytics/` — dashboard KPIs, revenue trend, lead funnel

**Step 5 — Shared Utilities**

```javascript
// backend/src/shared/response.helper.js
const success = (res, data, message = '', meta = {}, status = 200) =>
  res.status(status).json({ success: true, data, message, meta });

const error = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, error: { code, message } });
```

**Step 6 — Input Validation**

Use `express-validator`. Every route that accepts a body must have a validator file alongside its routes file. Validate:
- Email format on all email fields
- UUID format on all `:id` params
- Enum values on `role`, `status`, `priority` fields
- String length limits on all text fields

**Step 7 — Rate Limiting**

Use `express-rate-limit` with Redis store (`rate-limit-redis`):

```javascript
// backend/src/middleware/rateLimiter.js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 login attempts per window
  standardHeaders: true,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 100,                   // 100 requests per minute
  standardHeaders: true
});
```

Apply `authLimiter` to `/api/v1/auth/login` and `/api/v1/auth/register` only. Apply `apiLimiter` globally to all other `/api/v1/` routes.

### Deliverables Checklist

- [ ] `backend/src/config/` — db, redis, env config files
- [ ] `backend/src/modules/auth/` — 4 files: controller, service, routes, validator
- [ ] `backend/src/middleware/` — auth, rbac, rateLimiter, errorHandler, validate
- [ ] `backend/src/modules/{customers,leads,pipeline_stages,tasks,analytics}/` — full CRUD
- [ ] `backend/src/shared/response.helper.js`
- [ ] `backend/src/shared/logger.js` (Winston)
- [ ] `backend/src/app.js` and `backend/src/server.js`

### Constraints

- Passwords hashed with bcrypt (salt rounds: 12)
- Refresh tokens hashed before Redis storage
- No business logic in controllers — controllers call services, services call repositories
- Each module follows `routes → controller → service → repository` strictly
- No `SELECT *` queries — always specify column names

---

## 7. Phase 4 — Frontend Architecture

**Output location:** `frontend/src/`

**Tier:** MVP (v1.0)

### Objective

Build the complete React 18 frontend with Zustand state management, Axios HTTP client with interceptors, protected routing, the core layout shell, a fully wired analytics dashboard, and the lead pipeline Kanban board.

### Step-by-Step Guide

**Step 1 — Zustand Store Definitions**

Create four stores in `frontend/src/store/`:

```javascript
// authStore.js
{ user, accessToken, isAuthenticated, login(), logout(), refreshToken() }

// customerStore.js
{ customers[], total, page, filters, fetchCustomers(), createCustomer(), updateCustomer(), deleteCustomer() }

// leadStore.js
{ leads[], stages[], fetchLeads(), fetchStages(), moveLead(leadId, newStageId), createLead() }

// uiStore.js
{ sidebarCollapsed, notifications[], activeModal, toggleSidebar(), addNotification(), clearNotification() }
```

**Step 2 — Axios Instance with Interceptors**

Create `frontend/src/services/api.js`:
- Base URL from `VITE_API_BASE_URL` env variable
- Request interceptor: auto-attach `Authorization: Bearer {accessToken}` from auth store
- Response interceptor: on 401, call `/auth/refresh`, retry original request once; if refresh fails, call `logout()` and redirect to `/login`
- All API errors normalised to `{ code, message }` shape before reaching stores

**Step 3 — Route Definitions & Protected Routes**

Create `frontend/src/routes/`:

```
/                    → redirect to /dashboard
/login               → public, redirect to /dashboard if authenticated
/dashboard           → protected
/customers           → protected
/customers/:id       → protected
/leads               → protected
/tasks               → protected
/insights            → protected (v1.1 feature flag)
/settings            → protected, role: business_admin+
```

Implement `<ProtectedRoute>` component: checks `isAuthenticated` from auth store; redirects to `/login` if false.

**Step 4 — Core Layout Components**

Build in `frontend/src/components/layout/`:

- `Sidebar.jsx` — collapsible navigation, icon-only at `< 768px`, highlights active route
- `Navbar.jsx` — page title, user avatar dropdown (profile / logout), notification bell
- `PageWrapper.jsx` — consistent page padding, optional back button, title slot

Design language: **Clean, data-dense, professional. Reference: Linear.app meets HubSpot.**

CSS custom properties (define in `frontend/src/assets/globals.css`):

```css
--color-bg-base: #0f1117;
--color-bg-surface: #1a1d27;
--color-bg-elevated: #242736;
--color-border: #2e3347;
--color-accent: #5b6af0;
--color-accent-hover: #4a58e0;
--color-success: #22c55e;
--color-warning: #f59e0b;
--color-danger: #ef4444;
--color-text-primary: #f1f2f6;
--color-text-secondary: #8b93a7;
```

**Step 5 — Dashboard Page with KPI Cards**

Build `frontend/src/features/dashboard/DashboardPage.jsx` with four KPI cards wired to live API data via Recharts:

| Card | Metric | Chart |
|---|---|---|
| Total Revenue | Current month vs last month, % change | `<AreaChart>` — 30-day trend |
| Active Leads | Count with stage breakdown | `<BarChart>` mini inline |
| Conversion Rate | Leads → Deals, trend arrow | `<LineChart>` — 12-week |
| Customer Health Score | Avg across portfolio | `<RadialBarChart>` — gauge |

All loading states handled with **skeleton loaders** (not spinners). Use `useEffect` inside custom hooks (`useKPIData`, `useRevenueTrend`) — never call API directly inside components.

**Step 6 — Lead Pipeline Kanban Board**

Build `frontend/src/features/leads/LeadPipeline.jsx`:
- Columns = pipeline stages fetched from `/api/v1/pipeline-stages`
- Cards = lead cards with customer name, score badge, assigned avatar, value
- Drag-and-drop using `@hello-pangea/dnd` (fork of `react-beautiful-dnd`, React 18 compatible)
- On drop: optimistically update UI → call `PATCH /api/v1/leads/:id/stage` → rollback on error
- Empty state per column with "Add Lead" CTA

### Deliverables Checklist

- [ ] `frontend/src/store/` — authStore, customerStore, leadStore, uiStore
- [ ] `frontend/src/services/api.js` — Axios instance with full interceptors
- [ ] `frontend/src/routes/` — route definitions + ProtectedRoute component
- [ ] `frontend/src/components/layout/` — Sidebar, Navbar, PageWrapper
- [ ] `frontend/src/features/dashboard/DashboardPage.jsx` — 4 KPI cards + charts
- [ ] `frontend/src/features/leads/LeadPipeline.jsx` — full Kanban with drag-and-drop
- [ ] `frontend/src/assets/globals.css` — design token CSS variables

### Constraints

- No `any` types if using TypeScript; JSDoc types on all service functions if plain JS
- API calls only inside Zustand store actions or custom hooks — never directly in components
- All loading states handled with skeleton loaders, not spinners
- Mobile-responsive: sidebar collapses to icon-only at `< 768px`
- No `any` imports from Zustand — use typed selectors

---

## 8. Phase 5 — AI/ML Integration

**Output location:** `ml-service/` and `backend/src/shared/mlServiceClient.js`

**Tier:** v1.1

### Objective

Implement the full Python FastAPI ML microservice with three trained models on synthetic seed data, plus the Node.js client that calls it with retry logic and Redis cache fallback.

### Step-by-Step Guide

**Step 1 — FastAPI Application Structure**

Scaffold `ml-service/app/main.py` with:
- FastAPI app with CORS restricted to internal Docker network
- Lifespan event handler that loads all three `.pkl` model files on startup
- Health endpoint that verifies all models are loaded before returning `status: ok`
- Request logging middleware

**Step 2 — Synthetic Data Generator**

Create `ml-service/app/services/data_generator.py`:
- Generates 1,000 synthetic customer records with: `days_since_last_interaction`, `purchase_frequency`, `total_revenue`, `support_tickets`, `email_open_rate`, `churn_label`
- Generates 2,000 synthetic lead records with: `source`, `days_in_pipeline`, `email_responses`, `meetings_held`, `deal_value`, `converted_label`
- Saves to `ml-service/data/` as CSV for reproducibility
- Called during database seeding phase

**Step 3 — Three Trained Models**

Implement in `ml-service/app/pipelines/`:

```python
# churn_pipeline.py
# Model: RandomForestClassifier
# Features: days_since_last_interaction, purchase_frequency, total_revenue, support_tickets, email_open_rate
# Output: { churn_risk: float, confidence: float }
# Saved as: ml-service/app/models/churn_model.pkl

# revenue_pipeline.py
# Model: LinearRegression with seasonality features (month_sin, month_cos, quarter)
# Features: historical monthly revenue, pipeline value, headcount
# Output: { forecast: float, range: [low, high] }
# Saved as: ml-service/app/models/revenue_model.pkl

# lead_scorer_pipeline.py
# Model: GradientBoostingClassifier
# Features: source, days_in_pipeline, email_responses, meetings_held, deal_value
# Output: { score: int (0-100), tier: "hot"|"warm"|"cold" }
# Saved as: ml-service/app/models/lead_scorer_model.pkl
```

Each model must log on retrain: accuracy/MAE, precision, recall, F1 on a held-out 20% test set.

**Step 4 — Model Evaluation Guard**

In each pipeline's `retrain()` function:
```python
if new_model_score < current_model_score * 0.95:  # 5% tolerance
    log.warning("Retrained model underperforms. Keeping current production model.")
    return  # Do NOT overwrite .pkl file
```

**Step 5 — Insight Generation Engine**

Create `ml-service/app/services/insights.py` — rule + model hybrid:

```python
# Churn insight
if churn_risk > 0.70 and last_interaction_days > 30:
    yield "High churn risk: {n} customers haven't been contacted in 30+ days."

# Revenue insight
if forecast_growth > 0.15:
    yield "Revenue projected to grow {pct}% next quarter based on pipeline velocity."

# Lead insight
if enterprise_conversion_rate > smb_conversion_rate * 1.5:
    yield "Enterprise leads are converting at {x}x the rate of SMB leads this month."
```

**Step 6 — Node.js ML Service Client**

Create `backend/src/shared/mlServiceClient.js`:
- Axios instance pointing to `http://ml-service:8001`
- Retry logic: 3 attempts, exponential backoff (1s, 2s, 4s)
- On all retries failed: fetch last-known prediction from Redis (key: `ml:{endpoint}:{entityId}`, TTL 6 hours)
- Never throw to caller — always return a value (live or cached)
- Cache successful responses to Redis after every live call

### Deliverables Checklist

- [ ] `ml-service/app/main.py` — FastAPI app with lifespan model loading
- [ ] `ml-service/app/services/data_generator.py` — synthetic data generator
- [ ] `ml-service/app/pipelines/churn_pipeline.py` — RandomForestClassifier
- [ ] `ml-service/app/pipelines/revenue_pipeline.py` — LinearRegression
- [ ] `ml-service/app/pipelines/lead_scorer_pipeline.py` — GradientBoostingClassifier
- [ ] `ml-service/app/services/insights.py` — rule + model insight engine
- [ ] `ml-service/app/models/` — trained `.pkl` files (3)
- [ ] `ml-service/requirements.txt` — pinned versions
- [ ] `backend/src/shared/mlServiceClient.js` — Node.js client with retry + cache fallback

### Constraints

- All model files saved as `.pkl` using `joblib`
- No model logic in API route handlers — routes call services, services call model wrappers
- Health endpoint must verify all models are loaded before reporting `status: ok`
- ML service never exposed outside Docker internal network

---

## 9. Phase 6 — Real-Time & Background Jobs

**Output location:** `backend/src/jobs/` and `backend/src/sockets/`

**Tier:** v1.1

### Objective

Implement Socket.IO for real-time CRM events scoped to organisation rooms, and BullMQ for four scheduled background jobs with retry logic and failure logging.

### Step-by-Step Guide

**Step 1 — Socket.IO Setup**

In `backend/src/sockets/index.js`:
- Initialise Socket.IO on the Express HTTP server
- On connection: authenticate via JWT from `socket.handshake.auth.token`
- Join room `org:{organization_id}` — all events are scoped to this room
- Namespaces: `/crm` (default CRM events), `/notifications` (user-specific alerts)
- Never broadcast to all connected clients — always scope to `organization_id` room

**Step 2 — Real-Time Events**

Implement these four events, emitted from the relevant service files:

| Event | Emit location | Payload | Receivers |
|---|---|---|---|
| `lead:stage_changed` | `leads.service.js` after stage update | `{ leadId, fromStage, toStage, updatedBy }` | All org members |
| `task:assigned` | `tasks.service.js` after assignment | `{ taskId, assignedTo, assignedBy, title }` | Assigned user only |
| `insight:new` | `insights` BullMQ job | `{ insightId, type, summary }` | Admins + managers |
| `dashboard:kpi_update` | `aggregate-daily-metrics` job | `{ metrics: {...} }` | All connected org users |

**Step 3 — BullMQ Job Definitions**

Create four jobs in `backend/src/jobs/`:

| Job file | Schedule | Action | Max retries |
|---|---|---|---|
| `aggregateDailyMetrics.job.js` | Daily 00:00 UTC | Query analytics data → write to `analytics_snapshots` → emit `dashboard:kpi_update` | 3 |
| `sendFollowupReminders.job.js` | Daily 09:00 local | Find leads with no activity > 7 days → send email via nodemailer | 3 |
| `retrainModels.job.js` | Daily 02:00 UTC | POST to `ml-service/retrain` endpoint | 2 |
| `generateInsights.job.js` | Every 6 hours | GET `ml-service/insights/generate` → cache to Redis → emit `insight:new` | 3 |

All jobs must:
- Implement exponential backoff: `backoff: { type: 'exponential', delay: 1000 }`
- Log failures to `activity_logs` with `type: 'job_failure'` on final failure
- Return structured result: `{ success: boolean, processed: number, errors: [] }`

**Step 4 — BullMQ Queue Configuration**

Create `backend/src/jobs/queue.js`:
```javascript
// One queue per job category for independent scaling
const analyticsQueue = new Queue('analytics', { connection: redisClient });
const notificationsQueue = new Queue('notifications', { connection: redisClient });
const mlQueue = new Queue('ml', { connection: redisClient });

// Schedules registered via QueueScheduler + repeat options
```

### Deliverables Checklist

- [ ] `backend/src/sockets/index.js` — Socket.IO initialisation + auth + room join
- [ ] `backend/src/sockets/crm.events.js` — event emitter helpers
- [ ] `backend/src/jobs/queue.js` — BullMQ queue definitions
- [ ] `backend/src/jobs/aggregateDailyMetrics.job.js`
- [ ] `backend/src/jobs/sendFollowupReminders.job.js`
- [ ] `backend/src/jobs/retrainModels.job.js`
- [ ] `backend/src/jobs/generateInsights.job.js`
- [ ] `backend/src/jobs/worker.js` — registers all job processors

### Constraints

- All jobs must have retry logic (max 3 retries, exponential backoff)
- Failed jobs must log to `activity_logs` with `type: 'job_failure'`
- Socket.IO namespaces: `/crm` (default), `/notifications`
- No broadcasting to all connected clients — always scope to `organization_id` room

---

## 10. Phase 7 — DevOps & Deployment

**Output location:** `infra/` and individual service `Dockerfile`s

**Tier:** MVP (v1.0)

### Objective

Create the full containerised environment for local development and production deployment, with Nginx reverse proxy, environment variable management, and a GitHub Actions CI/CD pipeline.

### Step-by-Step Guide

**Step 1 — Dockerfiles (Multi-Stage Builds)**

Create a Dockerfile for each of the three services:

`frontend/Dockerfile`:
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`backend/Dockerfile`:
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/server.js"]
```

`ml-service/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**Step 2 — Docker Compose (Local Development)**

Create `infra/docker-compose.yml` with these six services:

```yaml
services:
  frontend:    # React (Nginx static, port 80)
  backend:     # Node.js Express (port 3000)
  ml-service:  # Python FastAPI (port 8001, internal only — no ports exposed to host)
  postgres:    # PostgreSQL 15
  redis:       # Redis 7 (Alpine)
  nginx:       # Reverse proxy (port 443 → frontend:80, /api → backend:3000)
```

Requirements:
- All services have `healthcheck` defined
- `ml-service` has no `ports` mapping — only accessible internally via `ml-service:8001`
- Volumes for PostgreSQL data persistence and Redis data persistence
- `backend` and `ml-service` depend on `postgres` and `redis` health checks

**Step 3 — Docker Compose (Production)**

Create `infra/docker-compose.prod.yml`:
- Extends the dev compose but overrides image tags with production registry paths
- No volume mounts of source code — images only
- Resource limits on all containers (cpu, memory)
- Restart policy: `unless-stopped`

**Step 4 — Nginx Configuration**

Create `infra/nginx/nginx.conf`:
- Route `/api/` → `backend:3000`
- Route `/socket.io/` → `backend:3000` (WebSocket upgrade headers)
- Route `/` → `frontend:80`
- Gzip compression on all text responses
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- Rate limiting at Nginx level: 30 req/s per IP (burst 60)

**Step 5 — Environment Variables**

Create `.env.example` at the project root with all required variables documented:

```bash
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/smartcrm

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=your-256-bit-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# ML Service (internal)
ML_SERVICE_URL=http://ml-service:8001

# Frontend
VITE_API_BASE_URL=http://localhost/api/v1

# Email (for BullMQ jobs)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Step 6 — GitHub Actions CI Pipeline**

Create `.github/workflows/ci.yml`:

```
Trigger: push to main, PR to main

Jobs:
  lint:     → ESLint (backend + frontend) + Black (ml-service)
  test:     → jest (backend unit + integration), vitest (frontend), pytest (ml-service)
  build:    → docker build all three images (verify no build errors)
  deploy:   → (on main branch only) push images to registry, trigger Railway redeploy
```

### Deliverables Checklist

- [ ] `frontend/Dockerfile` — multi-stage build
- [ ] `backend/Dockerfile` — multi-stage build
- [ ] `ml-service/Dockerfile` — slim Python build
- [ ] `infra/docker-compose.yml` — local dev (6 services + health checks)
- [ ] `infra/docker-compose.prod.yml` — production overrides
- [ ] `infra/nginx/nginx.conf` — reverse proxy + WebSocket + security headers
- [ ] `.env.example` — all variables documented with placeholder values
- [ ] `.github/workflows/ci.yml` — lint → test → build → deploy pipeline
- [ ] `docs/deployment.md` — step-by-step local setup instructions

### Constraints

- `ml-service` must NOT be exposed outside the Docker network — backend is its only consumer
- All secrets injected via environment variables, never baked into images
- Production Dockerfiles must use multi-stage builds to minimise image size
- Health checks required on all services in compose

---

## 11. Phase 8 — Testing & QA

**Output location:** `backend/src/tests/` and `frontend/src/` (co-located test files)

**Tier:** MVP (v1.0)

### Objective

Implement the full test suite covering backend unit tests, backend integration tests against a real test database, React component tests, and one end-to-end Cypress flow.

### Step-by-Step Guide

**Step 1 — Backend Unit Tests**

Use **Jest** + **Supertest**. Write unit tests for:

- `backend/src/modules/auth/auth.service.test.js`
  - `register()`: hashes password, inserts user, returns tokens
  - `login()`: rejects wrong password, issues correct TTL tokens
  - `refresh()`: validates Redis key, rejects expired tokens
  - `logout()`: deletes Redis refresh key

- `backend/src/modules/leads/leads.service.test.js`
  - `moveLead()`: validates stage belongs to same org, updates `pipeline_stage_id`, logs to `activity_logs`
  - `scoreLead()`: calls `mlServiceClient.getLeadScore()`, caches result to Redis

- `backend/src/shared/insights.test.js`
  - Churn insight rule fires when `churn_risk > 0.70 AND last_interaction_days > 30`
  - Revenue insight rule fires when `forecast_growth > 0.15`

**Step 2 — Integration Tests**

Every integration test runs against a **dedicated test PostgreSQL database** (not the dev database):

```javascript
// Test lifecycle (repeat for every suite)
beforeAll(async () => {
  await runMigrations(testDb);
  await seedTestData(testDb);
});

afterAll(async () => {
  await clearAllTables(testDb);
});
```

Write integration tests for:

- **Auth endpoints** (`auth.integration.test.js`)
  - Full register → login → access protected route → refresh → logout flow
  - Rate limiter blocks 11th login attempt within window

- **Customer CRUD** (`customers.integration.test.js`)
  - Create, read, update, delete customer
  - Org isolation: user from Org A cannot see Org B's customers
  - Search returns correct results, pagination is accurate

- **Lead pipeline** (`leads.integration.test.js`)
  - Create lead → move through 3 stages → verify `activity_logs` entry per move
  - Employee can only access own leads (RBAC enforcement)

**Step 3 — React Component Tests**

Use **Vitest** + **React Testing Library**. Write component tests for:

- `frontend/src/features/dashboard/KPICard.test.jsx`
  - Renders skeleton when `loading={true}`
  - Renders correct value and trend arrow when data is provided
  - Renders error state when API returns error

- `frontend/src/features/leads/LeadPipeline.test.jsx`
  - Renders correct number of columns from mock stages
  - Drag-and-drop fires `moveLead()` store action with correct arguments
  - Optimistic update reverts on API failure

**Step 4 — End-to-End Test (Cypress)**

Create `frontend/cypress/e2e/lead-lifecycle.cy.js`:

```
Scenario: Full lead lifecycle
1. Visit /login
2. Enter valid credentials → assert redirect to /dashboard
3. Navigate to /leads
4. Click "New Lead" → fill form → submit
5. Assert new lead card appears in "Prospect" column
6. Drag lead card to "Qualified" column
7. Assert card moved → assert API call logged in network tab
8. Click lead card → assert detail view shows updated stage
9. Assert stage change appears in activity log
```

### Deliverables Checklist

- [ ] `backend/src/modules/auth/auth.service.test.js` — unit tests
- [ ] `backend/src/modules/leads/leads.service.test.js` — unit tests
- [ ] `backend/src/shared/insights.test.js` — unit tests
- [ ] `backend/src/modules/auth/auth.integration.test.js`
- [ ] `backend/src/modules/customers/customers.integration.test.js`
- [ ] `backend/src/modules/leads/leads.integration.test.js`
- [ ] `frontend/src/features/dashboard/KPICard.test.jsx`
- [ ] `frontend/src/features/leads/LeadPipeline.test.jsx`
- [ ] `frontend/cypress/e2e/lead-lifecycle.cy.js`
- [ ] `backend/jest.config.js` and `frontend/vitest.config.js`

### Testing Standards

- Minimum **70% line coverage** on backend service layer (enforced in CI)
- Every API integration test runs against a test PostgreSQL database, seeded fresh per test suite
- No mocking of the database in integration tests — mock only external services (ML service, email)
- Test file naming: `*.test.js` for unit, `*.integration.test.js` for integration
- Test database created/destroyed by the CI pipeline — never the dev database

---

## 12. Quick Reference — Phase Prompt Template

> Copy this template exactly. Fill in the three bracketed fields. Send as the complete prompt.

```
[Paste Section 1 — Master Context Block (trimmed to phase-relevant elements only)]

[Paste Section 2 — Folder Structure (relevant subtree only)]

[Paste the specific Phase section from this document]

---
Additional context for this session:
- Currently building: [phase name and sub-task, e.g. "Phase 3a — Auth system only"]
- Already completed: [list previous phases, e.g. "Phase 1, Phase 2"]
- Specific focus: [narrow the scope if splitting, e.g. "Write auth.service.js only — routes and controller exist"]
- Rate-limit mode: Apply OUTPUT RULES from Section 3 strictly.
```

This keeps every generation grounded in the same context without re-explaining the full product from scratch. Each prompt is self-contained, and the model never needs to infer prior decisions.

---

*SmartCRM Engineering Prompt Series v2.0 — End of Document*

# SmartCRM — High-Level Architecture Diagram

> Version 1.0 · Phase 1 Deliverable · Last Updated 2026-05-28

---

## System Component Diagram

```
                          ┌─────────────────────────────────────────────────────────────┐
                          │                     INTERNET / CLIENT                        │
                          │                                                             │
                          │   Browser (React 18 SPA)                                    │
                          │   ┌───────────────────────────────────────────────────────┐  │
                          │   │  React 18 + Tailwind CSS + Zustand                   │  │
                          │   │  ─────────────────────────────────────                │  │
                          │   │  • Presentation Layer (SPA)                           │  │
                          │   │  • State: Zustand stores (auth, customer, lead, ui)   │  │
                          │   │  • HTTP Client: Axios with interceptors               │  │
                          │   │  • Charts: Recharts                                   │  │
                          │   │  • Routing: React Router v6 + ProtectedRoute guard    │  │
                          │   └───────────────────────┬───────────────────────────────┘  │
                          └───────────────────────────┼─────────────────────────────────┘
                                                      │
                                        HTTPS / REST  │  JSON (TLS 1.3)
                                        Port 443      │  via Nginx reverse proxy
                                                      │
┌─────────────────────────────────────────────────────┼───────────────────────────────────────────┐
│  INFRASTRUCTURE BOUNDARY (Docker Network: smartcrm_net)                                        │
│                                                     │                                          │
│                          ┌──────────────────────────▼──────────────────────────┐                │
│                          │            Nginx Reverse Proxy                      │                │
│                          │            Port 80 / 443 (external)                │                │
│                          │            ───────────────────────                  │                │
│                          │            • TLS termination                        │                │
│                          │            • Serves React static build             │                │
│                          │            • Proxies /api/* → Express              │                │
│                          │            • Rate limiting (connection level)       │                │
│                          └──────────────────────────┬─────────────────────────┘                │
│                                                     │                                          │
│                                       HTTP/1.1      │  Proxy pass                              │
│                                       Port 3000     │  (internal)                              │
│                                                     │                                          │
│  ┌──────────────────────────────────────────────────▼─────────────────────────────────────────┐ │
│  │                    Node.js + Express.js  (API Gateway + Business Logic)                    │ │
│  │                    Port 3000 (internal)                                                    │ │
│  │                    ───────────────────────────────────────────────                         │ │
│  │                                                                                           │ │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐  │ │
│  │  │  Middleware      │  │  Module Layer    │  │  Shared Services   │  │  Job Producers   │  │ │
│  │  │  ─────────────   │  │  ──────────────  │  │  ────────────────  │  │  ──────────────  │  │ │
│  │  │  • helmet()      │  │  auth/           │  │  response.helper   │  │  BullMQ queue    │  │ │
│  │  │  • cors()        │  │  customers/      │  │  logger (Winston)  │  │  producers for:  │  │ │
│  │  │  • express.json  │  │  leads/          │  │  mlServiceClient   │  │  • email-send    │  │ │
│  │  │  • morgan        │  │  pipeline_stages/│  │                    │  │  • retrain-model │  │ │
│  │  │  • rateLimiter   │  │  tasks/          │  │                    │  │  • daily-snapshot│  │ │
│  │  │  • auth.mw       │  │  analytics/      │  │                    │  │  • report-gen    │  │ │
│  │  │  • rbac.mw       │  │  insights/       │  │                    │  │                  │  │ │
│  │  │  • errorHandler  │  │                  │  │                    │  │                  │  │ │
│  │  └─────────────────┘  └──────────────────┘  └────────────────────┘  └──────────────────┘  │ │
│  │                                                                                           │ │
│  └─────┬──────────────────────────┬─────────────────────────────────────┬─────────────────────┘ │
│        │                          │                                     │                       │
│        │ TCP                      │ TCP                                 │ HTTP/1.1              │
│        │ Port 5432                │ Port 6379                           │ Port 8001             │
│        │                          │                                     │ (internal only)       │
│  ┌─────▼──────────────┐    ┌──────▼─────────────────────────┐    ┌─────▼──────────────────────┐ │
│  │   PostgreSQL 16    │    │   Redis 7                      │    │   Python FastAPI            │ │
│  │   Port 5432        │    │   Port 6379                    │    │   ML Microservice           │ │
│  │   ──────────────   │    │   ──────────────────────       │    │   Port 8001                 │ │
│  │                    │    │                                │    │   ──────────────────────     │ │
│  │  • Primary data    │    │  Cache Layer:                  │    │                              │ │
│  │    store           │    │  • JWT refresh token store     │    │  • Churn prediction model    │ │
│  │  • CRM entities    │    │  • API response cache          │    │  • Revenue forecast model    │ │
│  │  • Analytics       │    │  • ML prediction cache (6h)    │    │  • Lead scoring model        │ │
│  │    snapshots       │    │  • Rate limiter counters        │    │  • Insight generation        │ │
│  │  • Activity logs   │    │                                │    │  • Health endpoint           │ │
│  │  • Row-level       │    │  Queue Layer (BullMQ):         │    │                              │ │
│  │    tenancy via     │    │  • email-send queue            │    │  Models: scikit-learn .pkl   │ │
│  │    organization_id │    │  • retrain-models queue        │    │  Data: pandas, numpy         │ │
│  │                    │    │  • daily-snapshot queue         │    │  Deps: requirements.txt      │ │
│  │  Indexes:          │    │  • report-generation queue     │    │                              │ │
│  │  • org-scoped      │    │                                │    │  Internal only — never       │ │
│  │  • FK relations    │    │  Workers:                      │    │  exposed to public network   │ │
│  │  • Composite       │    │  • BullMQ worker processes     │    │                              │ │
│  └────────────────────┘    └────────────────────────────────┘    └──────────────────────────────┘ │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Descriptions

### Layer 1 — Presentation (Client)

| Attribute        | Value                                                    |
|------------------|----------------------------------------------------------|
| Runtime          | Browser (Chrome 90+, Firefox 88+, Safari 15+, Edge 90+) |
| Framework        | React 18 (Vite build toolchain)                          |
| State Management | Zustand — four stores: `authStore`, `customerStore`, `leadStore`, `uiStore` |
| HTTP Client      | Axios with request/response interceptors for JWT refresh |
| Styling          | Tailwind CSS with design token overrides via CSS custom properties |
| Visualisation    | Recharts — `AreaChart`, `BarChart`, `LineChart`, `RadialBarChart` |
| Routing          | React Router v6 with `<ProtectedRoute>` guard component  |
| Drag-and-Drop    | `@hello-pangea/dnd` for Kanban pipeline board            |

**Responsibility:** Renders all user-facing views. No business logic beyond UI state (e.g., sidebar toggle, modal visibility). All data fetching delegated to Zustand store actions or custom hooks that call the Axios service layer.

### Layer 2 — Reverse Proxy / Edge

| Attribute       | Value                                                       |
|-----------------|-------------------------------------------------------------|
| Server          | Nginx 1.25+                                                 |
| TLS             | TLS 1.3 termination via Let's Encrypt certificates          |
| Static Serving  | Serves React production build (`frontend/dist/`)            |
| API Proxy       | `location /api/ { proxy_pass http://api:3000; }`            |
| Rate Limiting   | Connection-level burst protection (`limit_req_zone`)        |
| Compression     | gzip on text/html, application/json, text/css, text/javascript |

**Responsibility:** Single external entry point. Terminates TLS, serves static assets, and proxies API requests to the Express backend. No application logic.

### Layer 3 — API Gateway + Business Logic

| Attribute     | Value                                                                 |
|---------------|-----------------------------------------------------------------------|
| Runtime       | Node.js 20 LTS                                                       |
| Framework     | Express.js 4.x                                                       |
| Port          | 3000 (internal Docker network only)                                   |
| Auth          | JWT access tokens (15-min TTL) + refresh tokens (7-day TTL, Redis-stored) |
| RBAC          | `requireRole()` and `requirePermission()` middleware factories        |
| Rate Limiting | `express-rate-limit` with Redis store — 10 RPM auth, 100 RPM general |
| Logging       | Winston (structured JSON) + Morgan (HTTP request logs)                |
| Validation    | `express-validator` on all request bodies and path params             |

**Module Architecture:** Each feature domain follows `routes → controller → service → repository`.

```
modules/
├── auth/           → register, login, refresh, logout, me
├── customers/      → CRUD + search + pagination
├── leads/          → CRUD + stage move + assignment
├── pipeline_stages/ → CRUD + reorder
├── tasks/          → CRUD + completion + filtering
├── analytics/      → dashboard KPIs, revenue trend, lead funnel
└── insights/       → proxied ML predictions + cached results
```

**Responsibility:** All business logic lives here. Controllers parse requests, services execute business rules, repositories interact with PostgreSQL. The ML service is consumed via `mlServiceClient.js` with retry logic and Redis cache fallback.

### Layer 4 — Primary Data Store (PostgreSQL)

| Attribute    | Value                                                      |
|--------------|------------------------------------------------------------|
| Engine       | PostgreSQL 16                                              |
| Port         | 5432 (internal Docker network only)                        |
| Schema       | 10 tables: `organizations`, `users`, `customers`, `leads`, `pipeline_stages`, `tasks`, `interactions`, `deals`, `activity_logs`, `analytics_snapshots` |
| Keys         | UUID primary keys (`gen_random_uuid()`)                    |
| Tenancy      | Row-level isolation via `organization_id` FK on every table |
| Indexes      | Org-scoped, FK-based, and composite indexes per query pattern |
| Connections  | Connection pool via `pg.Pool` (min: 2, max: 20)           |

**Responsibility:** Single source of truth for all CRM data. All queries use parameterised statements. No raw SQL string interpolation.

### Layer 5 — Cache + Queue (Redis)

| Attribute | Value                                                           |
|-----------|-----------------------------------------------------------------|
| Engine    | Redis 7.x                                                       |
| Port      | 6379 (internal Docker network only)                             |
| Cache Use | Refresh tokens (`refresh:{userId}`), ML prediction cache (6h TTL), rate limiter counters, API response cache for analytics endpoints |
| Queue Use | BullMQ — four queues: `email-send`, `retrain-models`, `daily-snapshot`, `report-generation` |
| Eviction  | `allkeys-lru` policy, max memory 256 MB                         |

**Responsibility:** Two distinct roles operating on the same Redis instance (separate logical databases):
1. **Cache (DB 0):** JWT refresh token storage, ML prediction fallback cache, rate limiter sliding window counters.
2. **Queue (DB 1):** BullMQ job queue for async workloads. Workers run in the same Node.js process (MVP) with extraction to dedicated worker processes planned for v2.0.

### Layer 6 — AI/ML Microservice (Python FastAPI)

| Attribute  | Value                                                                 |
|------------|-----------------------------------------------------------------------|
| Runtime    | Python 3.11+                                                         |
| Framework  | FastAPI 0.100+                                                       |
| Port       | 8001 (internal Docker network only — never exposed publicly)         |
| Models     | 3 scikit-learn models serialised as `.pkl`: churn predictor, revenue forecaster, lead scorer |
| Data Layer | Pandas for data manipulation; synthetic seed data for training       |
| Endpoints  | `POST /predict/churn`, `POST /predict/revenue`, `POST /predict/lead-score`, `GET /insights/generate`, `GET /health` |

**Responsibility:** Isolated ML inference service. Models are pre-trained on synthetic data generated during database seeding. Node.js backend calls this service via internal HTTP using `mlServiceClient.js`. Retraining is triggered by BullMQ cron job every 24 hours. If unreachable, Node.js returns cached predictions from Redis (TTL: 6 hours) — no hard failure propagation.

---

## Inter-Service Communication Protocols

| Source                   | Destination              | Protocol        | Port  | Auth Mechanism         | Notes                              |
|--------------------------|--------------------------|-----------------|-------|------------------------|------------------------------------|
| Browser (React SPA)      | Nginx                    | HTTPS (TLS 1.3) | 443   | Bearer JWT (header)    | All client traffic enters here     |
| Nginx                    | Express API              | HTTP/1.1        | 3000  | None (trusted network) | Proxy pass, X-Forwarded-* headers  |
| Express API              | PostgreSQL               | TCP (libpq)     | 5432  | Username + password    | Connection pool, parameterised SQL |
| Express API              | Redis                    | TCP (RESP)      | 6379  | Password (optional)    | Cache reads/writes + BullMQ ops    |
| Express API              | FastAPI ML Service       | HTTP/1.1        | 8001  | None (internal only)   | Retry 3x, 2s timeout, cache fallback |
| BullMQ Worker (Express)  | Redis                    | TCP (RESP)      | 6379  | Password (optional)    | Job dequeue + completion ACK       |
| BullMQ Worker (Express)  | FastAPI ML Service       | HTTP/1.1        | 8001  | None (internal only)   | Retrain trigger via POST           |

---

## Network Topology

```
                    Internet
                       │
                       ▼
              ┌────────────────┐
              │  Cloud LB /    │    (Production: AWS ALB / GCP LB)
              │  DNS + TLS     │    (Local dev: docker-compose ports)
              └───────┬────────┘
                      │
        ══════════════╪══════════════════  Docker Network: smartcrm_net
                      │
              ┌───────▼────────┐
              │     nginx      │    Exposed: 80, 443
              └───────┬────────┘
                      │ :3000
              ┌───────▼────────┐
              │      api       │    Internal only
              └──┬──────────┬──┘
                 │          │
        :5432 ───┤          ├─── :6379          :8001
                 │          │                     │
          ┌──────▼───┐  ┌───▼──────┐   ┌─────────▼────────┐
          │    db     │  │  redis   │   │   ml-service      │
          │ postgres  │  │  7.x     │   │   fastapi:8001    │
          └──────────┘  └──────────┘   └──────────────────┘
```

---

## Deployment Targets

| Environment  | Orchestration            | Notes                                    |
|--------------|--------------------------|------------------------------------------|
| Local Dev    | `docker-compose.yml`     | Hot-reload on all services               |
| Staging      | `docker-compose.prod.yml`| Production images, no hot-reload         |
| Production   | Docker Compose on single VPS (v1.0); Kubernetes planned for v2.0 | Horizontal scaling deferred |

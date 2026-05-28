# SmartCRM — Technical Decision Log

> Version 1.0 · Phase 1 Deliverable · Last Updated 2026-05-28

---

## Decision Record Format

Each entry follows a lightweight Architecture Decision Record (ADR) format. Decisions are numbered sequentially and considered **accepted** unless marked otherwise.

---

## Decision Summary Table

| # | Decision | Chosen | Rejected | Status |
|---|----------|--------|----------|--------|
| ADR-001 | Primary data store | PostgreSQL 16 | MongoDB 7.x | Accepted |
| ADR-002 | Frontend state management | Zustand 4.x | Redux Toolkit 2.x | Accepted |
| ADR-003 | ML/AI service runtime | Python FastAPI | Node.js (TensorFlow.js / ONNX) | Accepted |
| ADR-004 | Authentication strategy | JWT + Redis refresh tokens | Server-side session cookies | Accepted |
| ADR-005 | Background job processing | BullMQ 5.x | Raw Redis Pub/Sub | Accepted |

---

## ADR-001: PostgreSQL over MongoDB

| Attribute | Detail |
|-----------|--------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Context** | SmartCRM's core domain is inherently relational: organizations contain users who manage customers, leads flow through pipeline stages, deals reference leads, tasks reference both customers and leads. Analytics queries require multi-table JOINs, aggregations (SUM, AVG, COUNT), window functions, and date-range filtering. |
| **Chosen** | **PostgreSQL 16** |
| **Rejected** | **MongoDB 7.x** |

### Rationale

| Criterion | PostgreSQL | MongoDB |
|-----------|-----------|---------|
| Data model fit | CRM entities are highly relational with strict FK constraints. PostgreSQL enforces referential integrity at the database level, preventing orphaned records (e.g., a lead referencing a deleted customer). | Document model requires application-level joins via `$lookup`, which degrades performance at scale and pushes referential integrity to the application layer. |
| Query complexity | Native support for multi-table JOINs, CTEs, window functions (`ROW_NUMBER`, `RANK`), and `date_trunc` aggregations — all critical for analytics dashboard queries. | Aggregation pipeline can achieve similar results but with significantly more verbose syntax and less mature query optimisation for complex analytical workloads. |
| ACID compliance | Full ACID transactions across tables. Pipeline stage moves (update lead + insert activity log) execute atomically. | Multi-document transactions available since 4.0 but carry performance penalties and are not the idiomatic usage pattern. |
| Multi-tenancy | Row-level security (RLS) policies can enforce `organization_id` filtering at the database level, providing defense-in-depth for tenant isolation. | Tenant isolation achievable but requires consistent application of query filters — no database-level enforcement equivalent to RLS. |
| Indexing | B-tree, GIN (for `JSONB` and `TEXT[]` columns), and partial indexes. Composite indexes on `(org_id, created_at)` directly support the dominant query pattern. | Rich indexing capabilities but compound indexes have a 32-field limit and wildcard indexes incur storage overhead. |
| Schema flexibility | `JSONB` columns (e.g., `organizations.settings`, `activity_logs.metadata`) provide document-like flexibility where needed, without sacrificing relational guarantees on structured columns. | Native document flexibility — advantage when schema is truly undefined. Not the case for SmartCRM's well-defined entity model. |
| Ecosystem maturity | 35+ years of production hardening. `pg` driver for Node.js is battle-tested. Migration tooling (node-pg-migrate, Knex) is mature. | Mature ecosystem, but Mongoose ODM adds abstraction overhead and its population system doesn't scale well for complex relation graphs. |

### Consequences

- All schema changes require explicit migrations (tracked in `database/migrations/`).
- Team members must be proficient in SQL. No ORM abstraction — queries use parameterised `pg.Pool.query()`.
- `JSONB` columns used sparingly and only for genuinely semi-structured data (`settings`, `metadata`).

---

## ADR-002: Zustand over Redux

| Attribute | Detail |
|-----------|--------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Context** | SmartCRM's frontend requires four state domains: auth (tokens + user), customers (list + CRUD), leads (list + pipeline stages + drag state), and UI (sidebar, notifications, modals). Total state surface is moderate — no deeply nested state trees or complex derived state chains. |
| **Chosen** | **Zustand 4.x** |
| **Rejected** | **Redux Toolkit 2.x** |

### Rationale

| Criterion | Zustand | Redux Toolkit |
|-----------|---------|---------------|
| Boilerplate | Zero-boilerplate store creation. A complete store with actions is ~20 lines. No slices, no reducers, no action creators, no `configureStore`. | RTK significantly reduces vanilla Redux boilerplate, but still requires slice definitions, `createAsyncThunk` for async operations, and `Provider` wrapper at the app root. |
| Bundle size | ~1.1 KB gzipped (core). No dependencies. | ~11 KB gzipped (RTK + react-redux). 10x larger for a feature set that exceeds SmartCRM's requirements. |
| Learning curve | API surface is minimal: `create`, `set`, `get`, selectors. New team members productive within 30 minutes. | Requires understanding of slices, thunks, selectors, middleware chain, and the `Provider`/`useSelector`/`useDispatch` pattern. Onboarding time: 2–4 hours. |
| Async operations | Async actions are plain async functions inside the store — no middleware, no thunk abstraction, no `createAsyncThunk` ceremony. | `createAsyncThunk` provides structured async handling but introduces `pending`/`fulfilled`/`rejected` state management overhead for each async operation. |
| React integration | `useStore(selector)` — component subscribes to exactly the slice it needs. No `Provider` required. Renders only when selected state changes. | `useSelector` with shallow equality check. Requires `<Provider store={store}>` at app root. Equivalent re-render optimisation, but more setup. |
| DevTools | Supports Redux DevTools via `devtools` middleware — same debugging experience. | Native Redux DevTools support. Slight edge in time-travel debugging for complex state graphs. |
| Middleware | `devtools`, `persist`, `immer` — composable via middleware chain. Sufficient for SmartCRM's needs. | Rich middleware ecosystem (RTK Query, listener middleware). Overkill for SmartCRM's four-store architecture. |
| Scalability risk | At 10+ stores with complex inter-store dependencies, Zustand's flat store model can become harder to manage. SmartCRM has 4 stores — well within the comfort zone. | Better suited for applications with 20+ state domains and complex state interdependencies. SmartCRM doesn't reach this threshold. |

### Consequences

- Four independent stores (`authStore`, `customerStore`, `leadStore`, `uiStore`) — no shared root store.
- Async operations (API calls) live inside store actions. No separate middleware layer.
- If SmartCRM grows beyond 10 state domains with cross-store dependencies, revisit this decision.
- Redux DevTools integration enabled via `devtools` middleware for debugging.

---

## ADR-003: Python FastAPI for ML Service over Node.js ML

| Attribute | Detail |
|-----------|--------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Context** | SmartCRM requires three ML models: customer churn prediction (binary classification), revenue forecasting (regression), and lead scoring (multi-class classification). Models are trained on synthetic seed data, serialised as `.pkl` files, and served via a REST API consumed by the Node.js backend over the internal Docker network. |
| **Chosen** | **Python 3.11 + FastAPI 0.100+** |
| **Rejected** | **Node.js with TensorFlow.js or ONNX Runtime** |

### Rationale

| Criterion | Python FastAPI | Node.js ML |
|-----------|---------------|------------|
| ML ecosystem | scikit-learn, pandas, numpy, scipy — the canonical ML stack. Model training, feature engineering, and evaluation are idiomatic and well-documented. | TensorFlow.js supports inference but has limited training capabilities in Node.js. ONNX Runtime requires model conversion from Python-trained models, adding a build step. |
| Model training | Train directly in the same runtime that serves predictions. No serialisation format conversion. scikit-learn's `Pipeline` abstraction bundles preprocessing + model in a single `.pkl` artifact. | Training in Node.js is not practical for traditional ML models (random forest, gradient boosting). Would still require Python for training, then export to ONNX — adding complexity without benefit. |
| Data manipulation | pandas DataFrames provide expressive, performant data transformation for feature engineering. NumPy for numerical operations. | No equivalent to pandas in the Node.js ecosystem. `danfojs` exists but is immature and lacks the API surface needed for production feature engineering. |
| API framework | FastAPI provides automatic OpenAPI documentation, Pydantic request/response validation, async support, and sub-millisecond overhead per request. | Express.js could serve predictions, but combining it with Python model loading requires inter-process communication or spawning Python child processes — architecturally fragile. |
| Inference latency | scikit-learn model inference: 1–5ms per prediction. FastAPI adds <1ms overhead. Total: <10ms per request. | TensorFlow.js inference in Node.js is comparable for simple models but lacks GPU acceleration on most deployment targets. ONNX Runtime Node.js bindings add FFI overhead. |
| Team knowledge | ML engineers and data scientists universally work in Python. Hiring and onboarding for the ML component is straightforward. | Requiring ML work in Node.js limits the hiring pool and forces non-idiomatic patterns. |
| Isolation | Separate microservice with its own `Dockerfile`, `requirements.txt`, and deployment lifecycle. Python dependency conflicts cannot affect the Node.js backend. | Running ML in the same Node.js process risks memory pressure from model loading (scikit-learn models: 10–100 MB) and blocks the event loop during CPU-intensive inference. |

### Consequences

- Two runtimes in the stack: Node.js (API) + Python (ML). Docker Compose manages both.
- Internal HTTP communication adds ~1ms network latency per prediction call. Acceptable for the use case.
- ML service is never exposed publicly. Accessible only via `http://ml-service:8001` on the Docker network.
- If the ML service is unreachable, the Node.js backend returns cached predictions from Redis (TTL: 6 hours). No hard failure propagation.

---

## ADR-004: JWT + Redis Refresh Tokens over Session Cookies

| Attribute | Detail |
|-----------|--------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Context** | SmartCRM is a single-page application (SPA) communicating with a REST API. Authentication must support: stateless request validation, token refresh without re-login, multi-device sessions, and horizontal scaling of API servers without sticky sessions. |
| **Chosen** | **JWT access tokens (15-min TTL) + JWT refresh tokens (7-day TTL) stored in Redis** |
| **Rejected** | **Server-side session cookies (express-session + Redis store)** |

### Rationale

| Criterion | JWT + Redis Refresh | Session Cookies |
|-----------|-------------------|-----------------|
| Statelessness | Access tokens are self-contained. Any API server instance can validate a JWT by verifying its signature — no database or Redis lookup required on every request. | Every request requires a Redis lookup to load session data. Adds latency and creates a hard dependency on Redis availability for every authenticated request. |
| Horizontal scaling | API servers scale horizontally without coordination. No sticky sessions, no shared session state for request validation. | Requires either sticky sessions (limits load balancer flexibility) or a shared session store (Redis). Redis becomes a single point of failure for all requests. |
| SPA compatibility | Tokens stored in memory (Zustand store) and transmitted via `Authorization: Bearer` header. No CORS cookie configuration complexity. Works identically across browser tabs and mobile clients. | `Set-Cookie` with `SameSite=Strict`, `HttpOnly`, `Secure` flags. Requires careful CORS configuration. Third-party cookie restrictions in modern browsers can break cross-origin flows. |
| Token refresh | Refresh tokens stored in Redis with `refresh:{userId}` key and 7-day TTL. Rotation on each refresh — old token invalidated, new token issued. Compromise window: 15 minutes (access token TTL). | Session automatically extends on activity. No explicit refresh flow needed. Simpler, but session fixation attacks require active mitigation. |
| Revocation | Immediate: delete `refresh:{userId}` from Redis. Access tokens remain valid until expiry (max 15 minutes). Acceptable for CRM — not a banking application. | Immediate: delete session from Redis. More granular revocation, but this advantage is marginal given the 15-minute access token TTL. |
| Multi-device | Each device holds its own refresh token. Logout from one device doesn't affect others (unless `refresh:{userId}` key is structured per-device — extendable). | Session-per-device requires tracking multiple session IDs per user. Achievable but adds complexity. |
| Security model | Access token: short-lived, in-memory only (never `localStorage`). Refresh token: longer-lived, hashed before Redis storage. bcrypt hash prevents theft even if Redis is compromised. | Session ID in `HttpOnly` cookie — not accessible to JavaScript. Stronger XSS protection by default, but SmartCRM's in-memory token storage achieves equivalent protection. |

### Token Lifecycle

```
Login:
  → Issue accessToken (JWT, 15-min TTL, signed with JWT_SECRET)
  → Issue refreshToken (JWT, 7-day TTL)
  → Hash refreshToken with bcrypt → store hash in Redis as refresh:{userId}
  → Return both tokens to client

Request:
  → Client sends Authorization: Bearer {accessToken}
  → Middleware verifies signature + expiry
  → No Redis lookup required

Refresh:
  → Client sends refreshToken to /auth/refresh
  → Server retrieves hash from Redis refresh:{userId}
  → bcrypt.compare(refreshToken, storedHash)
  → Issue new accessToken + new refreshToken
  → Update Redis with new hash (token rotation)
  → Return new tokens

Logout:
  → DELETE refresh:{userId} from Redis
  → Client clears tokens from Zustand store
```

### Consequences

- Access tokens stored in Zustand (memory only) — never `localStorage` or `sessionStorage`.
- Refresh tokens hashed with bcrypt before Redis storage.
- Token rotation on every refresh: old refresh token is invalidated.
- Maximum revocation delay: 15 minutes (access token TTL). Acceptable for CRM use case.
- Axios response interceptor handles transparent token refresh on 401 responses.

---

## ADR-005: BullMQ over Raw Redis Pub/Sub

| Attribute | Detail |
|-----------|--------|
| **Status** | Accepted |
| **Date** | 2026-05-28 |
| **Context** | SmartCRM requires reliable background job processing for: email delivery, ML model retraining (24h cron), daily analytics snapshot generation, and report generation. Jobs must survive process restarts, support retry with backoff, and provide visibility into job status. |
| **Chosen** | **BullMQ 5.x** |
| **Rejected** | **Raw Redis Pub/Sub** |

### Rationale

| Criterion | BullMQ | Raw Redis Pub/Sub |
|-----------|--------|-------------------|
| Delivery guarantee | At-least-once delivery. Jobs are persisted in Redis streams and acknowledged only after successful processing. If a worker crashes mid-job, the job is automatically retried. | Fire-and-forget. If no subscriber is connected when a message is published, the message is lost permanently. No persistence, no acknowledgement, no retry. |
| Retry mechanism | Built-in exponential backoff with configurable `attempts` and `backoff` strategy. Failed jobs move to a dead-letter queue for manual inspection. | No retry capability. Application must implement its own retry logic, persistence, and dead-letter handling — reimplementing what BullMQ provides. |
| Job scheduling | Native cron-like repeat scheduling: `{ repeat: { cron: '0 2 * * *' } }` for daily model retraining. Delayed jobs with precise timestamp targeting. | No scheduling capability. Requires a separate scheduler (node-cron) to publish messages on a schedule, adding another process to manage. |
| Job visibility | Built-in dashboard support (Bull Board). Job states: `waiting`, `active`, `completed`, `failed`, `delayed`. Programmatic access to job progress and logs. | No job state concept. Messages are transient — once delivered (or lost), there's no record. Debugging production issues requires custom logging infrastructure. |
| Concurrency control | `concurrency` option per worker. Rate limiting per queue. Priority queues. Prevents resource exhaustion from burst job creation. | No concurrency control. All messages delivered as fast as subscribers can process them. Resource exhaustion risk during traffic spikes. |
| Worker isolation | Workers can run in separate processes or threads. Clean separation between API server and job processing. Extractable to dedicated worker services in v2.0. | Subscribers run in the same process. No isolation between request handling and background processing. |
| Redis compatibility | Uses Redis Streams (Redis 5.0+) — persistent, ordered, consumer-group-aware. Leverages Redis' strongest primitives for job queue semantics. | Uses Redis Pub/Sub channels — ephemeral, no persistence, no consumer groups. Not designed for reliable job processing. |

### Job Definitions

| Queue | Trigger | Schedule | Retry Policy | Worker Action |
|-------|---------|----------|--------------|---------------|
| `email-send` | API event (lead created, task assigned) | Immediate | 3 attempts, exponential backoff (1s, 4s, 16s) | Send transactional email via SMTP |
| `retrain-models` | BullMQ cron | `0 2 * * *` (daily at 02:00 UTC) | 2 attempts, 30-minute delay | POST to FastAPI `/retrain` endpoint |
| `daily-snapshot` | BullMQ cron | `0 3 * * *` (daily at 03:00 UTC) | 3 attempts, exponential backoff | Aggregate metrics, INSERT into `analytics_snapshots` |
| `report-generation` | User request (export) | Immediate | 2 attempts, 5-minute delay | Generate CSV/PDF, store in temp storage, notify user |

### Consequences

- BullMQ runs on the same Redis instance as the cache layer (separate logical database: DB 1).
- Workers run in-process during MVP (v1.0). Extracted to dedicated worker containers in v2.0.
- Bull Board dashboard integrated at `/admin/queues` (protected by `super_admin` role).
- Job failures logged to `activity_logs` with `type: 'job_failure'` for operational visibility.

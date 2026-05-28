# 🚀 SmartCRM — Business Analytics & Management Platform

SmartCRM is an intelligent, multi-tenant customer relationship management (CRM) and business analytics platform. It is engineered for growing teams (10–200 employees) to manage high-density sales pipelines, track customer interactions, and aggregate real-time business health metrics without the bloat of enterprise legacy systems.

## 🏗️ System Architecture

The platform utilizes a decoupled, feature-first modular architecture, ensuring strict data isolation, high-performance query execution, and a scalable foundation for future Machine Learning integrations.

### Core Tech Stack

* **Frontend**: React 18 + Tailwind CSS + Zustand *(Planned for Phase 4)*
* **Backend API Gateway**: Node.js + Express.js
* **Database Layer**: PostgreSQL *(Raw parameterized queries via pg pool)*
* **Caching & Queues**: Redis (ioredis) + BullMQ
* **Security**: JWT (Access/Refresh Token Rotation) + bcrypt hashing

## 🗺️ Project Milestones Achieved

### Phase 1: Architectural Foundation
* **System Blueprints**: Mapped comprehensive High-Level Design (HLD) and critical user journey data flows.
* **Technical Decisions**: Locked in ADRs (Architecture Decision Records) for PostgreSQL, Redis, and JWT session handling.
* **Multi-Tenancy Plan**: Designed row-level tenant isolation via `org_id` to ensure absolute data privacy across distinct business accounts.

### Phase 2: Database Engine
* **Schema Design**: Implemented a highly relational PostgreSQL schema covering organizations, users, customers, leads, deals, and tasks.
* **Performance Tuning**: Applied extensive indexing strategies (e.g., composite indexes on `org_id` and foreign keys) for rapid aggregation.
* **Deterministic Seeding**: Created an idempotent development seed script generating realistic, relational mock data for testing Kanban pipelines and revenue funnels.

### Phase 3: Backend API & Security
* **Authentication Core**: Built a stateless JWT auth engine with Redis-backed refresh token rotation, session invalidation, and bcrypt cryptographic hashing.
* **Role-Based Access Control (RBAC)**: Integrated dynamic middleware enforcing strict permission matrixes (`super_admin`, `business_admin`, `manager`, `employee`).
* **Feature Modules (CRUD)**: 
  * **Customers**: Paginated portfolios with dynamic `ILIKE` search capabilities.
  * **Leads & Pipeline**: Transaction-bound Kanban stage movements (`BEGIN`/`COMMIT`) ensuring atomic updates and activity logging.
  * **Analytics Telemetry**: Complex SQL aggregations processing revenue trends, active lead counts, and global conversion rates directly at the database layer.

## 📁 Repository Structure

```text
smartcrm/
├── backend/                           # Node.js + Express API core
│   └── src/
│       ├── config/                    # DB pool, Redis client, envalid validation
│       ├── middleware/                # JWT auth, RBAC guards, global error handling
│       ├── modules/                   # MVC Feature Modules
│       │   ├── analytics/             # SQL aggregation engines for dashboards
│       │   ├── auth/                  # Crypto, token rotation, login/register
│       │   ├── customers/             # Profile management and search
│       │   ├── leads/                 # Kanban pipeline and atomic transactions
│       │   └── tasks/                 # Polymorphic to-do tracking
│       └── shared/                    # Response envelopes and Winston loggers
├── database/                          # PostgreSQL artefacts
│   ├── migrations/                    # Schema state versions
│   └── seeds/                         # dev-seed.sql for local environment
└── docs/                              # Architecture blueprints and ADRs
```

## 🛣️ Core API Routes

All endpoints are prefixed with `/api/v1/` and enforce `org_id` multi-tenant boundaries.

### Authentication
* `POST /auth/register` — Provision new user
* `POST /auth/login` — Issue Access & Refresh Tokens
* `POST /auth/refresh` — Rotate tokens via Redis verification
* `GET /auth/me` — Fetch protected session context

### CRM Operations *(Requires Bearer Token)*
* `GET /customers` — Paginated list with `?search=` filters
* `PATCH /leads/:id/stage` — Move lead through Kanban pipeline (Atomic)
* `GET /leads/stages` — Retrieve organization's pipeline columns
* `GET /tasks` — Fetch tasks filtered by `?assigned_to=` or `?status=`

## 🛠️ Local Development Setup

### 1. Prerequisites

Ensure you have the following installed:
* Node.js (v20+)
* PostgreSQL (v15+)
* Redis (v7+)

### 2. Database Initialization

Create the database and run the schema and seed scripts:

```bash
# Enter your PostgreSQL CLI
psql -U postgres -c "CREATE DATABASE smartcrm_dev;"

# Apply schema and seed data
psql -U postgres -d smartcrm_dev -f database/schema.sql
psql -U postgres -d smartcrm_dev -f database/seeds/dev-seed.sql
```

### 3. Environment Configuration

Navigate to the `backend` directory and configure your secrets:

```bash
cd backend
cp .env.example .env
```
Update the `.env` file with your local database/Redis URIs and generate secure random strings for your JWT secrets.

### 4. Boot the Server

Install dependencies and start the Express gateway:

```bash
npm install
npm run dev
```

The server will initialize the connection pools and listen on `http://localhost:3000`.
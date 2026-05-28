# SmartCRM — API Versioning Strategy

> Version 1.0 · Phase 1 Deliverable · Last Updated 2026-05-28

---

## Versioning Scheme

### Method: URI Path Versioning

All API routes are prefixed with a version identifier in the URI path:

```
https://api.smartcrm.io/api/v{major}/resource
```

**Examples:**
```
GET  /api/v1/customers
POST /api/v1/leads
GET  /api/v2/customers
```

### Why URI Path Versioning

| Method | Considered | Decision |
|--------|-----------|----------|
| URI path (`/api/v1/`) | ✅ Chosen | Explicit, cacheable, tooling-friendly, zero client configuration |
| Header (`Accept-Version: v1`) | ❌ Rejected | Hidden versioning — harder to debug, test, and document. CDN caching requires `Vary` header configuration. |
| Query parameter (`?version=1`) | ❌ Rejected | Pollutes query string, complicates caching, non-standard. |
| Content negotiation (`Accept: application/vnd.smartcrm.v1+json`) | ❌ Rejected | Overly complex for a B2B SaaS product with a single first-party client. Appropriate for public API platforms, not internal-first APIs. |

### Version Numbering Rules

- **Major version only** in the URI path: `v1`, `v2`, `v3`.
- Minor and patch changes are deployed within the existing version without URI change.
- A new major version is created **only** when a breaking change is introduced.

---

## What Constitutes a Breaking Change

A change is **breaking** if any existing client integration would fail or produce incorrect results without modification.

### Breaking Changes (Require New Major Version)

| Change Type | Example |
|-------------|---------|
| Removing an endpoint | `DELETE /api/v1/reports` is removed |
| Removing a response field | `data.customer.health_score` is removed from response |
| Changing a response field type | `data.lead.score` changes from `number` to `object` |
| Renaming a response field | `data.lead.assignedTo` renamed to `data.lead.assigned_user_id` |
| Changing a required request field | `customer_id` changes from `string` to `object` |
| Adding a new required request field | `POST /leads` now requires `priority` (previously optional) |
| Changing HTTP status code semantics | `200` response now returns `201` for the same operation |
| Changing error code values | `LEAD_NOT_FOUND` renamed to `RESOURCE_NOT_FOUND` |
| Changing authentication mechanism | Bearer token format changes |

### Non-Breaking Changes (Deployed Within Existing Version)

| Change Type | Example |
|-------------|---------|
| Adding a new endpoint | `GET /api/v1/reports` is introduced |
| Adding an optional request field | `POST /leads` accepts optional `notes` field |
| Adding a response field | `data.lead.last_contacted_at` added to response |
| Adding a new enum value | `lead.source` gains `"partner"` option |
| Fixing a bug in response data | Correcting an incorrect calculation |
| Performance improvements | Query optimisation, caching changes |
| Adding new error codes | `RATE_LIMITED` added alongside existing codes |

---

## Deprecation Policy

### Minimum Support Window: 2 Major Versions

At any time, SmartCRM guarantees support for **at minimum the current version and one prior version**.

```
Timeline:

  v1 released ─────────────────────────────────────────────────────────►
                                                                        
  v2 released ─────────────────────────────────────────────────────────►
  v1 deprecated (still functional)                                      
                                                                        
  v3 released ─────────────────────────────────────────────────────────►
  v2 deprecated (still functional)                                      
  v1 sunset (removed) ──── X                                            
```

### Deprecation Lifecycle

| Phase | Duration | API Behavior |
|-------|----------|-------------|
| **Active** | Until next major version is released | Fully supported. Receives bug fixes and non-breaking enhancements. |
| **Deprecated** | Minimum 6 months after deprecation notice | Fully functional. Receives critical security fixes only. No new features. Deprecation headers included in every response. |
| **Sunset** | After deprecation period ends | All endpoints return `410 Gone`. Response body includes migration documentation link. |

### Deprecation Timeline Example

```
2026-06-01   v1 launched (Active)
2026-12-01   v2 launched (Active); v1 transitions to Deprecated
2027-06-01   v1 sunset date (6-month minimum); v1 endpoints return 410
             v2 remains Active
```

---

## Breaking Change Communication

### Response Headers

Every API response includes versioning metadata:

```http
HTTP/1.1 200 OK
X-API-Version: v1
X-API-Deprecated: true
X-API-Sunset-Date: 2027-06-01
X-API-Latest-Version: v2
X-API-Changelog: https://docs.smartcrm.io/api/changelog
```

| Header | Presence | Description |
|--------|----------|-------------|
| `X-API-Version` | Always | The version serving this response |
| `X-API-Deprecated` | Only when deprecated | Boolean flag indicating this version is deprecated |
| `X-API-Sunset-Date` | Only when deprecated | ISO 8601 date when this version will be removed |
| `X-API-Latest-Version` | Always | The latest available API version |
| `X-API-Changelog` | Always | URL to the API changelog |

### Implementation

```javascript
// backend/src/middleware/apiVersion.middleware.js

const apiVersionHeaders = (version, latestVersion) => (req, res, next) => {
  res.set('X-API-Version', version);
  res.set('X-API-Latest-Version', latestVersion);
  res.set('X-API-Changelog', `${process.env.DOCS_BASE_URL}/api/changelog`);

  const deprecatedVersions = {
    // Populated when versions are deprecated
    // 'v1': { sunset: '2027-06-01' }
  };

  if (deprecatedVersions[version]) {
    res.set('X-API-Deprecated', 'true');
    res.set('X-API-Sunset-Date', deprecatedVersions[version].sunset);
  }

  next();
};
```

### Notification Channels

| Channel | Timing | Audience |
|---------|--------|----------|
| API response headers | Every response on deprecated version | All consumers |
| Changelog (`docs/api/CHANGELOG.md`) | At deprecation announcement | Developers |
| Email notification | 6 months, 3 months, 1 month, 1 week before sunset | Organization admins |
| Dashboard banner | When consuming deprecated API version | All authenticated users |
| Winston log warning | Every request to deprecated version | Operations team |

---

## Route Registration Pattern

### Express Router Structure

```javascript
// backend/src/app.js

const v1Router = require('./routes/v1');
// const v2Router = require('./routes/v2');  // Added when v2 is created

app.use('/api/v1', apiVersionHeaders('v1', 'v1'), v1Router);
// app.use('/api/v2', apiVersionHeaders('v2', 'v2'), v2Router);
```

```javascript
// backend/src/routes/v1/index.js

const router = require('express').Router();

router.use('/auth', require('../../modules/auth/auth.routes'));
router.use('/customers', require('../../modules/customers/customers.routes'));
router.use('/leads', require('../../modules/leads/leads.routes'));
router.use('/pipeline-stages', require('../../modules/pipeline_stages/pipeline_stages.routes'));
router.use('/tasks', require('../../modules/tasks/tasks.routes'));
router.use('/analytics', require('../../modules/analytics/analytics.routes'));
router.use('/insights', require('../../modules/insights/insights.routes'));

module.exports = router;
```

### Version Migration Strategy

When introducing `v2`:

1. **Copy** the `v1` route index to `v2` route index.
2. **Modify** only the routes with breaking changes — unchanged routes delegate to the same service layer.
3. **Service layer remains version-agnostic.** Versioning lives exclusively in the route/controller layer.
4. **Repository layer is shared.** Database queries do not change between API versions.

```
Route Layer (versioned)          Service Layer (shared)         Repository Layer (shared)
────────────────────             ─────────────────────          ────────────────────────
v1/customers.routes.js  ──►     customers.service.js  ──►     customers.repository.js
v2/customers.routes.js  ──►     customers.service.js  ──►     customers.repository.js
                                (same instance)                (same instance)
```

This architecture ensures:
- No code duplication in business logic between versions.
- Response shape transformation happens in the controller layer only.
- Database schema changes are additive and backward-compatible.

---

## Client Migration Guide Template

When a new version is released, the following migration guide is published:

```markdown
# Migrating from v{N} to v{N+1}

## Breaking Changes

| Endpoint | Change | v{N} Behavior | v{N+1} Behavior | Migration Action |
|----------|--------|---------------|-----------------|------------------|
| ...      | ...    | ...           | ...             | ...              |

## New Endpoints

| Endpoint | Description |
|----------|-------------|
| ...      | ...         |

## Deprecated Endpoints (Removed in v{N+1})

| Endpoint | Replacement |
|----------|-------------|
| ...      | ...         |

## Timeline

- v{N+1} available: YYYY-MM-DD
- v{N} deprecated: YYYY-MM-DD
- v{N} sunset: YYYY-MM-DD (minimum 6 months)
```

---

## Sunset Response Format

When a sunset version is accessed:

```http
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "API_VERSION_SUNSET",
    "message": "API version v1 has been sunset as of 2027-06-01. Please migrate to v2.",
    "migration_guide": "https://docs.smartcrm.io/api/migration/v1-to-v2",
    "latest_version": "v2"
  }
}
```

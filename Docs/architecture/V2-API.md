# V2 API

**Status:** HTTP contract for web and mobile  
**Implementation:** `apps/api` — FastAPI + Pydantic v2  
**Auth:** Bearer Supabase JWT

Clients do not use PostgREST as the application API. FastAPI is the write path, pricing authority, sync ingest, and PDF generator.

---

## 1. Base

```
https://{api-host}/api/v1
```

HTTPS only in staging/production. JSON in/out. UTF-8. Hebrew strings allowed in bodies.

**Workspace context:** most routes are nested:

```
/api/v1/workspaces/{workspace_id}/customers
```

Alternatively `X-Workspace-Id` for a few user-level routes (`/me`, `/notifications`). Nested path is preferred — it makes logs and authz obvious.

---

## 2. Auth handshake

1. Client signs in with Supabase Auth (email/password).
2. Client sends `Authorization: Bearer <access_token>`.
3. API validates JWT against Supabase (JWKS).
4. API loads `profiles` + memberships.
5. For workspace routes: membership must be `active`.
6. API builds a user-scoped Supabase client (caller JWT) so RLS applies.
7. `authorize(action, resource)` runs before the mutation.

`/api/v1/auth/session` returns the hydrated session (profile, memberships, features, role, technician_code) so clients do not stitch this themselves.

---

## 3. Error envelope

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "אין הרשאה לשלוח הצעת מחיר",
    "details": {}
  }
}
```

| HTTP | When |
|------|------|
| 400 | Validation |
| 401 | Missing/invalid JWT |
| 403 | Authz deny |
| 404 | Not found **or** not visible (do not leak cross-tenant existence) |
| 409 | Conflict (sync, unique code, stale version) |
| 422 | Semantic validation |
| 429 | Rate limit |
| 500 | Unexpected (logged with request id) |

Every response includes `X-Request-Id`.

---

## 4. Pagination, filter, sort

List endpoints:

```
?limit=50&cursor=<opaque>
&q=
&status=
&sort=-updated_at
```

Default limit 50, max 100. No unbounded dumps.  
Cursor pagination for operational lists (jobs, notifications). Offset allowed for small settings tables.

---

## 5. Resource map (v1)

| Prefix | Resource |
|--------|----------|
| `/auth` | session, logout hint, password (delegates to Supabase where needed) |
| `/me` | profile, notification preferences |
| `/workspaces` | create, get, update, members, invitations |
| `.../customers` | CRUD + contacts + 360 aggregate |
| `.../sites` | CRUD + dossier read model |
| `.../systems` | CRUD |
| `.../equipment` | CRUD |
| `.../leads` | CRUD + status transitions |
| `.../catalog/products` | CRUD |
| `.../catalog/categories` | CRUD |
| `.../quotes` | CRUD, send, totals, pdf, events |
| `.../projects` | CRUD, create-from-quote |
| `.../jobs` | CRUD, start, complete, checklist, signature |
| `.../service-calls` | CRUD, convert-to-job |
| `.../documents` | upload intent, complete, signed GET |
| `.../warranties` | issue, get |
| `.../tasks` | CRUD |
| `.../notifications` | list, mark read |
| `.../reports` | later |
| `.../billing` | later |
| `/sync` | mobile batch |
| `/public/sites/{token}` | tokenized dossier (end customer; **not** marketing) |
| `/public/warranties/{token}` | tokenized warranty |
| `/public/inquiries` | **future** Public Web contact/pilot request — **not** tenant `leads` |

Inventory routes appear in Phase 11; until then they 404, they are not fake 200s.

---

## 6. Quote pricing (authoritative)

```
POST /workspaces/{id}/quotes/{quote_id}/recalculate
PATCH /workspaces/{id}/quotes/{quote_id}
```

Server:

1. Load items + product costs the caller is allowed to see
2. Compute line nets, discount, VAT, totals, margin
3. Persist totals on `quotes`
4. Return full quote

The client may send quantities and unit prices (if permitted). The client may **not** send `total_gross` as gospel. Unknown extra fields are ignored (`extra = forbid` on money fields).

PDF:

```
POST /workspaces/{id}/quotes/{quote_id}/pdf
```

Renders from **stored** totals, not from a client HTML screenshot.

---

## 7. Documents

1. `POST .../documents/uploads` → `{ upload_url, document_id, storage_path }` after authz
2. Client PUTs bytes to signed upload URL
3. `POST .../documents/{id}/complete` → checksum/size verify
4. Read via `GET .../documents/{id}/url` (short-lived signed GET)

Never return a permanent public URL for tenant files.

---

## 8. Idempotency

Mutating endpoints accept `Idempotency-Key`.  
Stored per workspace for 24h. Sync **requires** the header.

---

## 9. Rate limiting (architecture)

Middleware buckets:

- Auth-ish: tight (login is on Supabase; invite-accept and public token routes are on us)
- Authenticated API: per user + workspace
- Public token: per IP + token
- Sync: per device

Implementation: in-process limiter for single node; Redis when horizontally scaled. Interface is behind a protocol so we can switch.

---

## 10. Logging and observability

Structured JSON logs: `request_id`, `user_id`, `workspace_id`, `action`, `latency_ms`, `status`.

Do not log tokens, passwords, signed URLs, or full PII bodies.

Audit-worthy actions also write `audit_logs` (invite, role change, quote approve, job assign, plan change, settings change).

Prepare hooks for Sentry/OpenTelemetry in config; wiring is Phase 16.

---

## 11. OpenAPI and types

FastAPI generates OpenAPI. CI generates `packages/api-client` for web and mobile.

Pydantic models are the HTTP contract. They are **not** 1:1 table dumps (no `cost_total` on quote responses without `quotes.view_cost`).

---

## 12. Versioning

Breaking changes → `/api/v2`. Additive fields are allowed in v1. Deprecate with headers, don’t silently rename.

---

## 13. What the API will not do

- Accept `role` from the client as a permission override
- Trust `workspace_id` in the body that disagrees with the path
- Expose other tenants as 403 vs 404 differently in a way that enumerates (use 404)
- Run arbitrary SQL
- Host Aegis marketing lead forms
- Write Public Web contact forms into tenant `customers` or `leads` (SITE SECURE inquiries are a separate public resource when that endpoint ships)

# SITE SECURE V2 — Architecture

**Status:** Source of truth for V2 engineering  
**Companion:** [V1 → V2 decisions](./V1-TO-V2.md)  
**Rule:** One platform, three clients. Public Web, authenticated Web, and mobile are not three products.

```
                         SITE SECURE V2
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          PUBLIC WEB       AUTH WEB        MOBILE
              │               │               │
         Marketing origin   /app + auth    Expo
              │               │               │
              └───────────────┼───────────────┘
                              │
                         API /v1
                              │
                           FASTAPI
                              │
                 ┌────────────┼────────────┐
                 │            │            │
              DATABASE     STORAGE      REALTIME
                 │
              SUPABASE (new project)
                 │
         AUTH / RLS / RBAC / STORAGE
```

Public Web specification: [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md).  
Authenticated Web: [V2-WEB.md](./V2-WEB.md).  
Mobile: [V2-MOBILE.md](./V2-MOBILE.md).

---

## 1. Product architecture

SITE SECURE V2 is a **multi-tenant SaaS** for security-system businesses (CCTV, alarm, access control, networking).

It connects:

Business → Customers → Sites → Systems → Equipment → Technicians → Projects → Jobs → Service → Quotes → Inventory → Documents → Warranties → Operations

**Clients**

| Client | Primary users | Job |
|--------|---------------|-----|
| Public Web | Visitor (no workspace) | Trust, value, pilot/signup, contact. SEO origin. **Not** `/app` |
| Authenticated Web (`/app`) | Owner, Administrator, Manager, Sales (field roles: Today, not ops) | Density, CRM, quotes, ops command |
| Mobile (`apps/mobile`) | Technician, Founding Technician | Today’s work, offline, capture. Same Auth user + workspace as web |
| Tokenized public routes | End customer of a **tenant** | Narrow site dossier / warranty (`/p/s/:token`, `/p/w/:token`). Not marketing |

A person can start on the public origin, register, use `/app`, then the Expo app — **one identity, one workspace, one FastAPI**.

**Not in V2 bootstrap**

- Aegis authentication or `/site-secure` mount
- Demo/localStorage runtime
- Automatic V1 data migration
- A second backend for mobile
- Treating the public origin as “later marketing” or as a screen inside the authenticated shell

**Invariant:** a user in Workspace A cannot read or write Workspace B data. UI filtering is not a control. Enforcement is RLS + API authorization + query scoping.

---

## 2. Web architecture

Two web surfaces, usually **one origin**, different jobs.

**Public Web** — [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md)

- Visitor marketing IA (pain, ROI *illustrative*, Site File concept, Digital Twin concept, trust, pilot, pricing, FAQ, about, contact)
- Doors: `/login`, `/register` (trial/pilot)
- Crawlable HTML required. No tenant JWT, no RBAC, no Realtime, no tenant Storage
- Public inquiry is **not** tenant CRM

**Authenticated Web** — [V2-WEB.md](./V2-WEB.md)

- React 19 + TypeScript, Vite, TanStack Router/Query, Tailwind v4 + `@site-secure/design-system`
- Hebrew-first `dir="rtl"` `lang="he"`
- `/app/*` after JWT + membership; talks to FastAPI with the Supabase access token
- Subscribes to selected Realtime channels (jobs, notifications, quote status) when that phase ships
- Never holds `SUPABASE_SERVICE_ROLE_KEY`
- Optimized for information density. Field workflows on a phone use the native app, not a squeezed desktop shell
- `/app` is **noindex**

---

## 3. Mobile architecture

See [V2-MOBILE.md](./V2-MOBILE.md) and [V2-OFFLINE-SYNC.md](../mobile/V2-OFFLINE-SYNC.md).

- React Native + Expo + TypeScript
- Same API contracts and authz catalog as web
- Local SQLite (via Expo SQLite) as the offline cache
- Sync queue with idempotency keys
- Push via a later provider (architecture ready; FCM/APNs wired in notifications phase)
- UX: Today → Job → Next action. Not a clone of web navigation.

---

## 4. Backend architecture

See [V2-API.md](./V2-API.md).

- Python 3.12+
- FastAPI
- Pydantic v2
- One deployable: `apps/api`
- Versioned HTTP: `/api/v1/...`

**Responsibilities that belong in FastAPI (not in the client, not only in SQL):**

- Authorization engine (same catalog as clients)
- Quote pricing and totals
- PDF generation
- Invite acceptance side effects
- Job state machine
- Offline sync ingest (idempotency, conflicts)
- Signed URL minting
- Billing webhooks (when enabled)
- Audit event emission
- Notification fan-out

**Supabase client usage in the API**

| Mode | When |
|------|------|
| User-scoped client (caller JWT) | Almost all tenant CRUD — RLS still applies |
| Service role | Webhooks, cron, email send, admin repair — **must** set `workspace_id` in code and log the bypass |

---

## 5. Database architecture

See [V2-DATABASE-DESIGN.md](../database/V2-DATABASE-DESIGN.md).

- PostgreSQL 15+ on a **new** Supabase project
- Schema-as-code under `/supabase/migrations`
- UUID primary keys
- `workspace_id` on every tenant-owned row
- Generated types from the schema (`packages/types`)
- No V1 migration replay

**Aggregate roots (mental model)**

```
Workspace
 ├── Members / Invitations / Assignments
 ├── Customers
 │     └── Contacts
 ├── Sites
 │     ├── Zones
 │     ├── Systems → Equipment
 │     ├── Documents / Photos
 │     └── Warranties
 ├── Leads
 ├── Quotes → Items / Versions / Events
 ├── Catalog (Products / Categories)
 ├── Projects → Jobs
 ├── Service Calls → Jobs
 ├── Tasks
 └── Notifications / Audit
```

Site File is **not** a root. It is the dossier UX over Site + children + timeline.

---

## 6. Supabase architecture

**New project. No V1 project ref. No V1 schema.**

| Service | Use in V2 |
|---------|-----------|
| Auth | Email/password, verify, reset, sessions, refresh |
| Postgres | System of record |
| RLS | Tenant + membership + assignment isolation |
| Storage | Private buckets, signed URLs |
| Realtime | Selected tables/channels only |
| Edge Functions | Only when the edge is the right place (e.g. Auth hooks). Business logic lives in FastAPI. |

**Clients receive**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**API receives additionally**

- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `API_SECRET` / signing keys as needed

If credentials are missing, development stops at configuration — they are never invented.

---

## 7. Multi-tenancy

**Tenant = Workspace.**

- A user authenticates as themselves (identity).
- Access to data requires an **active membership** in that workspace.
- Creating a workspace is explicit (onboarding). Identity without membership is a valid state (`has_workspace = false`).
- A user may belong to multiple workspaces. `profiles.last_workspace_id` is a preference, not a permission.
- Switching workspace reloads authz context. Tokens do not encode “current tenant” as the only check; every query carries `workspace_id` and RLS checks membership.

**Isolation layers**

1. Postgres RLS (`workspace_id` IN memberships)
2. FastAPI `authorize()` + mandatory workspace in path or header
3. API query builders always filter `workspace_id`
4. UI only lists the active workspace

Layer 4 is convenience. Layers 1–3 are security.

---

## 8. Authentication

Authentication answers **who is this user?**  
Authorization answers **what can they do?**  
They do not share a code path except that authz requires a valid user.

**Flows**

| Flow | Mechanism |
|------|-----------|
| Register | Supabase signUp + email verification |
| Login | Email/password |
| Password reset | Supabase recovery email |
| Session | Supabase JWT access + refresh |
| Logout | `signOut` all or local |
| Invite | `invitations` row → email → accept → membership |
| No workspace | App onboarding only; no implicit tenant |

**Rejected V1 behaviors**

- Redirect to Aegis login
- Shared `aegis-spectra-auth` storage key
- Demo auth

**Future (not bootstrap):** SSO/OIDC (including Aegis as an IdP), magic link as a first-class product option (the API can already call Supabase OTP if we enable it).

---

## 9. RBAC

See [V2-RBAC.md](../security/V2-RBAC.md).

One engine. One catalog. No role-string business logic in pages.

```
authorize({ user, workspace, action, resource, context })
  Authenticated
  → Tenant active
  → Subscription valid
  → Feature included
  → Role loaded
  → Permission granted
  → Scope check
  → Resource state
  → Business rules
  → ALLOW | DENY
```

Initial roles: `owner`, `administrator`, `manager`, `sales`, `technician`, `founding_technician`, `viewer`.

Plans expose **features**. Features do not grant permissions. Permissions are granted to roles.

---

## 10. RLS

See [V2-RLS.md](../security/V2-RLS.md).

- Every tenant table has RLS enabled.
- No `USING (true)` on tenant data.
- Helpers are `SECURITY DEFINER` with locked `search_path`.
- Founding Technician / technician `assigned` scope is enforced in RLS for technician-visible resources — not only in the UI.
- Tests: Workspace A JWT cannot select Workspace B rows.

---

## 11. API

See [V2-API.md](./V2-API.md).

```
/api/v1/auth
/api/v1/workspaces
/api/v1/customers
/api/v1/sites
/api/v1/systems
/api/v1/projects
/api/v1/jobs
/api/v1/service-calls
/api/v1/quotes
/api/v1/catalog
/api/v1/inventory
/api/v1/documents
/api/v1/notifications
/api/v1/reports
/api/v1/billing
/api/v1/sync          # mobile offline
```

Conventions: Pydantic request/response models, cursor or page pagination, stable error envelope, structured logs, rate-limit architecture.

Internal table names are not a public contract. External names are `customer`, `site`, `job`, `quote`.

---

## 12. Storage

Private by default. Signed URLs minted by the API after `authorize()`.

| Bucket | Contents |
|--------|----------|
| `photos` | Field and site photos |
| `documents` | Site/customer/quote files |
| `signatures` | Job completion signatures |
| `branding` | Workspace logo / PDF header |
| `exports` | Generated PDF/CSV (short-lived) |

Path convention: `{workspace_id}/{entity}/{id}/{filename}` so storage policies can match the JWT’s membership.

Public **marketing** assets do not live in tenant buckets (`{workspace_id}/…`). They are repo/static or a non-tenant public asset location. Tenant files stay private + signed URLs.

---

## 13. Realtime

Use where an operator or technician would otherwise refresh to see a **state change they did not cause**.

| Event | Channel value |
|-------|----------------|
| Job assigned / updated / completed | Technician Today + manager ops |
| Quote approved / rejected | Sales + owner |
| Service call created | Assigned technician / managers |
| Notification inserted | In-app bell |

Do not realtime-list every CRM table. Lists stay Query-based with invalidation on events.

---

## 14. Offline sync

See [V2-OFFLINE-SYNC.md](../mobile/V2-OFFLINE-SYNC.md).

Mobile: local DB → outbox → `POST /api/v1/sync` → Postgres.

Guarantees: retry, idempotency keys, conflict detection, no silent overwrite, upload queue for photos/signatures.

Web is online-first (quote autosave may retry; it is not a full offline client).

---

## 15. Notifications

One pipeline. Multiple channels.

**Events (initial):** `JOB_ASSIGNED`, `JOB_UPDATED`, `JOB_COMPLETED`, `QUOTE_SENT`, `QUOTE_APPROVED`, `SERVICE_CREATED`, `SERVICE_UPDATED`, `PAYMENT_RECEIVED`, `SYNC_FAILED`, `USER_INVITED`.

**Channels:** in-app (required), email (transactional), push (mobile, phase 12).

Preferences per user per workspace. Deduplicate by `(workspace_id, event_type, entity_id, recipient_id)` within a time window.

---

## 16. Billing

Billing data is separate from marketing copy.

```
plans → plan_features + plan_limits
subscriptions (workspace-level)
workspace_features (effective set, derived from plan + overrides)
```

Tiers to seed: `solo`, `business`, `enterprise`. Prices are **not** hardcoded in UI components; they come from `plans` (or a config package that mirrors the table).

Stripe (or equivalent) is integrated in Phase 14. Until then, a workspace can be seeded with a plan for development. No fake checkout in production.

---

## 17. Testing

Mandatory suites, mapped to the ten critical cases:

| # | Case | Layer |
|---|------|-------|
| 1 | Cross-workspace access denied | RLS + API |
| 2 | Technician cannot perform admin actions | Authz unit + API |
| 3 | Viewer cannot mutate restricted data | Authz + API |
| 4 | Missing/invalid JWT fails | API |
| 5 | RLS blocks cross-tenant even with crafted filters | SQL |
| 6 | Offline sync does not duplicate | Sync integration |
| 7 | Conflicts detected, not overwritten | Sync |
| 8 | Quote totals correct | Pricing unit + API |
| 9 | Client cannot manipulate server totals | API |
| 10 | Files require authorization | Storage + API |

Also: unit (engine, pricing), API, web component where valuable, Playwright for quote + onboarding, Maestro/Detox later for the job completion path.

---

## 18. Deployment

| Piece | Direction |
|-------|-----------|
| Web | Static (Vite) on Vercel/Netlify or similar; own origin |
| API | Container (Fly/Render/Cloud Run) behind HTTPS |
| Mobile | EAS Build (iOS/Android) |
| DB/Auth/Storage | Supabase project: `dev` / `staging` / `prod` |

Environments are separate Supabase projects. Never share prod service role with local web.

CI: typecheck, lint, unit, API tests, migration dry-run.

---

## 19. Security

See [V2-RBAC.md](../security/V2-RBAC.md), [V2-RLS.md](../security/V2-RLS.md), [THREAT-MODEL.md](../security/THREAT-MODEL.md).

Non-negotiables:

- New Supabase project
- RLS on tenant tables
- Service role server-only
- Server-authoritative pricing
- Private storage + signed URLs
- Audit log for security-relevant events
- Rate limiting at API gateway / FastAPI middleware
- Validation: Zod (TS) + Pydantic (Python)
- No secrets in git or client bundles

---

## 20. UX architecture

See [V2-UX-PSYCHOLOGY.md](../ux/V2-UX-PSYCHOLOGY.md) and [V2-DESIGN-SYSTEM.md](../ux/V2-DESIGN-SYSTEM.md).

Principle: **make the next action obvious.**

Psychology is used for clarity and trust, never for dark patterns (fake urgency, fake scarcity, deceptive cancellation, hidden fees).

Visual language: security, trust, precision, professionalism. Steel-blue primary. Semantic color. Spacing scale 4–64. Lucide icons. No emoji UI, no decorative dashboards.

Every shipped screen is reviewed against the 18-point checklist in the UX document.

---

## Monorepo

```
apps/
  web/                 # Public origin + auth pages + /app (route split; marketing HTML must be SEO-capable)
  mobile/              # Expo
  api/                 # FastAPI
packages/
  types/               # generated DB types + shared DTOs
  api-client/          # typed fetch client used by web + mobile
  validation/          # Zod schemas mirrored from OpenAPI/Pydantic
  authz/               # catalog JSON + TS helpers
  design-system/       # tokens (web CSS + RN theme)
  ui/                  # web components
  config/              # env names, feature keys
supabase/
  migrations/
  seed/
  functions/
docs/
```

Python does not import TypeScript. It loads `packages/authz/catalog.json` (copied into the API image). OpenAPI from FastAPI generates the TS client in CI so types do not drift.

---

## AI readiness (not implementation)

Future assistants (quote recommendations, site summaries, ops insights) must:

- Run in FastAPI (or a worker) with workspace context
- Pass `authorize()` before reading entities
- Write audit rows
- Never train across tenants

No random chat widget in v2.0.

---

## Implementation order

Architecture (this folder) → database migrations → auth/workspace/RBAC/RLS → API foundation → web foundation + design system → mobile foundation → **public origin (marketing) as its own UX product** → domain modules by roadmap.

Public Website is not “another `/app` screen.” Visitor → marketing → signup → auth → onboarding → app, in parallel with technician → mobile → same workspace.

Do not start with hundreds of UI screens.

See [V2-ROADMAP.md](./V2-ROADMAP.md).
